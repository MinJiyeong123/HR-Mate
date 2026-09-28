package com.hrmate.employee.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hrmate.employee.domain.Employee;
import com.hrmate.employee.domain.EmploymentStatus;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * employee 테이블(V1 마이그레이션)과 EmployeeRepository 검증
 *
 * - 테스트 DB(hr_mate_test, test 프로필)에 접속한다. 개발 DB(hr_mate)에는 접속하지 않는다.
 * - 각 테스트는 트랜잭션 안에서 실행되고 끝나면 롤백되어 데이터가 남지 않는다.
 * - 테이블을 만들거나 지우지 않도록 ddl-auto 를 validate 로 고정한다.
 * - 테스트용 사번은 ZZTEST 로 시작한다.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=validate")
class EmployeeRepositoryTest {

    private static final LocalDate HIRE_DATE = LocalDate.of(2024, 3, 4);

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private EntityManager entityManager;

    private Employee save(String employeeNo) {
        return employeeRepository.saveAndFlush(
                Employee.create(employeeNo, "테스트", HIRE_DATE, "인사팀", "대리", "010-0000-0000", "test@example.com"));
    }

    /** JPA 규칙을 거치지 않고 DB 제약만 확인하기 위한 직접 INSERT */
    private void insertRaw(String employeeNo, String status, LocalDate hireDate, LocalDate resignationDate) {
        entityManager.createNativeQuery("""
                        INSERT INTO employee (employee_no, name, hire_date, employment_status, resignation_date, created_at, updated_at)
                        VALUES (?1, '테스트', ?2, ?3, ?4, NOW(6), NOW(6))
                        """)
                .setParameter(1, employeeNo)
                .setParameter(2, hireDate)
                .setParameter(3, status)
                .setParameter(4, resignationDate)
                .executeUpdate();
    }

    private static void assertViolates(Runnable action, String constraintName) {
        assertThatThrownBy(action::run).hasStackTraceContaining(constraintName);
    }

    @Test
    void 저장하면_내부_ID와_생성_시각이_기록된다() {
        Employee saved = save("zztest01");
        entityManager.clear();

        Employee found = employeeRepository.findByIdAndDeletedAtIsNull(saved.getId()).orElseThrow();
        assertThat(found.getId()).isNotNull();
        assertThat(found.getEmployeeNo()).isEqualTo("ZZTEST01");
        assertThat(found.getEmploymentStatus()).isEqualTo(EmploymentStatus.ACTIVE);
        assertThat(found.getCreatedAt()).isNotNull();
        assertThat(found.getUpdatedAt()).isNotNull();
    }

    @Test
    void 사번_존재_여부는_대소문자를_구분하지_않는다() {
        save("ZZTEST02");

        assertThat(employeeRepository.existsByEmployeeNo("ZZTEST02")).isTrue();
        assertThat(employeeRepository.existsByEmployeeNo("zztest02")).isTrue();
        assertThat(employeeRepository.existsByEmployeeNo("ZZTEST99")).isFalse();
    }

    @Test
    void 같은_사번은_저장할_수_없다() {
        save("ZZTEST03");

        assertThatThrownBy(() -> save("zztest03"))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasStackTraceContaining("uk_employee_employee_no");
    }

    @Test
    void 논리_삭제된_사원은_목록과_조회에서_제외되지만_사번은_계속_사용_중이다() {
        Employee kept = save("ZZTEST04");
        Employee removed = save("ZZTEST05");

        removed.delete();
        employeeRepository.flush();
        entityManager.clear();

        List<String> listed = employeeRepository.findAllByDeletedAtIsNullOrderByEmployeeNoAsc().stream()
                .map(Employee::getEmployeeNo)
                .filter(no -> no.startsWith("ZZTEST"))
                .toList();
        assertThat(listed).containsExactly(kept.getEmployeeNo());
        assertThat(employeeRepository.findByIdAndDeletedAtIsNull(removed.getId())).isEmpty();
        assertThat(employeeRepository.findById(removed.getId())).isPresent(); // 행은 남아 있음
        assertThat(employeeRepository.existsByEmployeeNo("ZZTEST05")).isTrue();
    }

    @Test
    void 퇴사_처리와_재직_정정이_저장된다() {
        Employee employee = save("ZZTEST06");

        employee.changeEmployment(HIRE_DATE, EmploymentStatus.RESIGNED, HIRE_DATE.plusYears(1));
        employeeRepository.flush();
        employee.changeEmployment(HIRE_DATE, EmploymentStatus.ACTIVE, null);
        employeeRepository.flush();
        entityManager.clear();

        Employee found = employeeRepository.findById(employee.getId()).orElseThrow();
        assertThat(found.getEmploymentStatus()).isEqualTo(EmploymentStatus.ACTIVE);
        assertThat(found.getResignationDate()).isNull();
    }

    @Test
    void DB는_소문자_사번을_거부한다() {
        assertViolates(() -> insertRaw("zztest07", "ACTIVE", HIRE_DATE, null), "ck_employee_employee_no_format");
    }

    @Test
    void DB는_영문_숫자_외의_사번을_거부한다() {
        assertViolates(() -> insertRaw("ZZ-TEST08", "ACTIVE", HIRE_DATE, null), "ck_employee_employee_no_format");
    }

    @Test
    void DB는_정의되지_않은_재직_상태를_거부한다() {
        assertViolates(() -> insertRaw("ZZTEST09", "LEAVE", HIRE_DATE, null), "ck_employee_employment_status");
    }

    @Test
    void DB는_재직_상태의_퇴사일을_거부한다() {
        assertViolates(() -> insertRaw("ZZTEST10", "ACTIVE", HIRE_DATE, HIRE_DATE), "ck_employee_resignation_date");
    }

    @Test
    void DB는_퇴사일_없는_퇴사_상태를_거부한다() {
        assertViolates(() -> insertRaw("ZZTEST11", "RESIGNED", HIRE_DATE, null), "ck_employee_resignation_date");
    }

    @Test
    void DB는_입사일보다_이른_퇴사일을_거부한다() {
        assertViolates(() -> insertRaw("ZZTEST12", "RESIGNED", HIRE_DATE, HIRE_DATE.minusDays(1)), "ck_employee_resignation_date");
    }

    @Test
    void DB는_올바른_퇴사_정보를_허용한다() {
        insertRaw("ZZTEST13", "RESIGNED", HIRE_DATE, HIRE_DATE);

        assertThat(employeeRepository.existsByEmployeeNo("ZZTEST13")).isTrue();
    }

    @Test
    void DB는_중복_사번_직접_입력도_거부한다() {
        save("ZZTEST14");

        assertViolates(() -> insertRaw("ZZTEST14", "ACTIVE", HIRE_DATE, null), "uk_employee_employee_no");
    }
}
