package com.hrmate.employee;

import static java.util.stream.Collectors.counting;
import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.joining;
import static org.assertj.core.api.Assertions.assertThat;

import com.hrmate.employee.domain.Employee;
import com.hrmate.employee.domain.EmploymentStatus;
import com.hrmate.employee.repository.EmployeeRepository;
import jakarta.persistence.EntityManager;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * 데모 데이터 SQL(docs/sample-data/sample-employees.sql) 검증
 *
 * - 파일의 INSERT 문을 테스트 DB(hr_mate_test)에서 실행해 본다. 파일의 USE hr_mate; 줄은 건너뛴다.
 * - 테스트 트랜잭션이 끝나면 롤백되어 테스트 DB에도 남지 않는다.
 * - 개발 DB(hr_mate)에는 접속하지 않는다. (test 프로필, hrmate_test 계정)
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=validate")
class SampleDataScriptTest {

    /** Gradle 테스트 작업 폴더(backend) 기준 경로 */
    private static final Path SCRIPT = Path.of("..", "docs", "sample-data", "sample-employees.sql");

    private static final List<String> SAMPLE_EMPLOYEE_NOS = List.of(
            "E2018002", "E2019001", "E2020003", "E2020011", "E2021002", "E2021007",
            "E2022004", "E2023001", "E2023005", "E2024002", "E2025003", "E2025011");

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private EmployeeRepository employeeRepository;

    private static String readScript() throws IOException {
        return Files.readString(SCRIPT, StandardCharsets.UTF_8);
    }

    /**
     * 주석, USE 문, COMMIT 문을 뺀 INSERT 문 (끝의 ; 제외)
     * COMMIT 은 테스트에서 실행하지 않는다. 실행하면 테스트 트랜잭션의 롤백이 깨진다.
     */
    private static String insertStatement(String script) {
        String body = script.lines()
                .filter(line -> !line.strip().startsWith("--"))
                .filter(line -> !line.strip().toUpperCase(Locale.ROOT).startsWith("USE "))
                .filter(line -> !line.strip().equalsIgnoreCase("COMMIT;"))
                .collect(joining("\n"))
                .strip();
        return body.endsWith(";") ? body.substring(0, body.length() - 1) : body;
    }

    /** 주석을 뺀 실행 문장 목록 (세미콜론 기준) */
    private static List<String> statements(String script) {
        String body = script.lines()
                .filter(line -> !line.strip().startsWith("--"))
                .collect(joining("\n"));
        return Arrays.stream(body.split(";"))
                .map(String::strip)
                .filter(statement -> !statement.isEmpty())
                .toList();
    }

    private long countAllEmployees() {
        return ((Number) entityManager.createNativeQuery("SELECT COUNT(*) FROM employee").getSingleResult()).longValue();
    }

    @Test
    void 파일은_USE_INSERT_COMMIT_세_문장으로_이루어져_있다() throws IOException {
        List<String> statements = statements(readScript()).stream()
                .map(statement -> statement.toUpperCase(Locale.ROOT))
                .toList();

        assertThat(statements).hasSize(3);
        assertThat(statements.get(0)).isEqualTo("USE HR_MATE");
        assertThat(statements.get(1)).startsWith("INSERT INTO EMPLOYEE");
        assertThat(statements.get(2)).isEqualTo("COMMIT"); // 자동 커밋이 꺼진 세션에서도 입력을 확정
    }

    @Test
    void 파일은_개발_DB를_대상으로_INSERT_한_문장만_담고_있다() throws IOException {
        String script = readScript();

        List<String> useLines = script.lines().map(String::strip)
                .filter(line -> line.toUpperCase(Locale.ROOT).startsWith("USE "))
                .toList();
        assertThat(useLines).containsExactly("USE hr_mate;");

        String sql = insertStatement(script).toUpperCase(Locale.ROOT);
        assertThat(sql).startsWith("INSERT INTO EMPLOYEE");
        assertThat(sql).doesNotContain(";"); // 한 문장
        // 단어 단위로 검사한다. (컬럼명 UPDATED_AT 은 UPDATE 문이 아니다)
        assertThat(sql).doesNotContainPattern("\\b(DELETE|TRUNCATE|DROP|ALTER|REPLACE)\\b");
        assertThat(sql).doesNotContain("INSERT IGNORE");
        assertThat(sql.replace("ON DUPLICATE KEY UPDATE", "")).doesNotContainPattern("\\bUPDATE\\b");
        assertThat(sql).doesNotContain("E2026001"); // 시연 등록용으로 비워 둔 사번
    }

    @Test
    void 테스트_DB에서_12명이_모든_규칙을_통과하고_두_번_실행해도_중복되지_않는다() throws IOException {
        assertThat(countAllEmployees()).isZero();
        String sql = insertStatement(readScript());

        int inserted = entityManager.createNativeQuery(sql).executeUpdate();
        entityManager.createNativeQuery(sql).executeUpdate(); // 두 번째 실행: 새 행이 생기면 안 된다
        entityManager.clear();

        assertThat(inserted).isEqualTo(12);
        assertThat(countAllEmployees()).isEqualTo(12);

        List<Employee> employees = employeeRepository.findAllByDeletedAtIsNullOrderByEmployeeNoAsc();
        assertThat(employees).extracting(Employee::getEmployeeNo).containsExactlyElementsOf(SAMPLE_EMPLOYEE_NOS);

        Map<EmploymentStatus, Long> byStatus = employees.stream()
                .collect(groupingBy(Employee::getEmploymentStatus, counting()));
        assertThat(byStatus).containsExactlyInAnyOrderEntriesOf(Map.of(
                EmploymentStatus.ACTIVE, 10L,
                EmploymentStatus.RESIGNED, 2L));

        Map<String, Long> byDepartment = employees.stream()
                .collect(groupingBy(e -> e.getDepartment() == null ? "(미지정)" : e.getDepartment(), counting()));
        assertThat(byDepartment).containsExactlyInAnyOrderEntriesOf(Map.of(
                "인사팀", 2L, "재무팀", 2L, "개발팀", 3L, "영업팀", 2L, "마케팅팀", 2L, "(미지정)", 1L));

        assertThat(employees).allSatisfy(employee -> {
            assertThat(employee.getPhone()).isNull();
            assertThat(employee.getEmail()).satisfiesAnyOf(
                    email -> assertThat(email).isNull(),
                    email -> assertThat(email).endsWith("@example.com"));
            assertThat(employee.isDeleted()).isFalse();
        });
    }
}
