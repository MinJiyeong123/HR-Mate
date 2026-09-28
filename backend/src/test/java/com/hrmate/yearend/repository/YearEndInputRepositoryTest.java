package com.hrmate.yearend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hrmate.employee.domain.Employee;
import com.hrmate.employee.repository.EmployeeRepository;
import com.hrmate.yearend.calculator.PersonalDeductionInput;
import com.hrmate.yearend.domain.YearEndInput;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * 연말정산 입력 자료 테이블(V3 마이그레이션)과 리포지토리 검증
 *
 * - 테스트 DB(hr_mate_test, test 프로필)에서만 실행한다. 개발 DB(hr_mate)에는 접속하지 않는다.
 * - 각 테스트는 끝나면 롤백되어 데이터가 남지 않는다. 테스트용 사번은 ZZYE 로 시작하고, 연도는 2099년을 사용한다.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=validate")
class YearEndInputRepositoryTest {

    private static final PersonalDeductionInput VALUES = new PersonalDeductionInput(true, 2, 1, 0, false, false, 1, 1, 0, 0);

    @Autowired
    private YearEndInputRepository inputRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private EntityManager entityManager;

    private Employee employee(String employeeNo) {
        return employeeRepository.saveAndFlush(
                Employee.create(employeeNo, "연말가상", LocalDate.of(2020, 1, 1), "인사팀", "대리", null, null));
    }

    /** 제약 확인용 직접 입력 (spouse, dependent, elderly, singleParent, child, birthFirst) */
    private void insertRow(Long employeeId, int year, boolean spouse, int dependents, int elderly,
                           boolean singleParent, int children, int birthFirst) {
        entityManager.createNativeQuery("""
                        INSERT INTO year_end_input (employee_id, tax_year, spouse_deduction, dependent_count, elderly_count,
                            disabled_count, woman_deduction, single_parent_deduction, child_credit_count,
                            birth_first_count, birth_second_count, birth_third_plus_count, created_at, updated_at)
                        VALUES (?1, ?2, ?3, ?4, ?5, 0, FALSE, ?6, ?7, ?8, 0, 0, NOW(6), NOW(6))
                        """)
                .setParameter(1, employeeId).setParameter(2, year).setParameter(3, spouse).setParameter(4, dependents)
                .setParameter(5, elderly).setParameter(6, singleParent).setParameter(7, children).setParameter(8, birthFirst)
                .executeUpdate();
    }

    private static void assertViolates(Runnable action, String constraintName) {
        assertThatThrownBy(action::run).hasStackTraceContaining(constraintName);
    }

    @Test
    void 저장하고_사원_연도로_다시_읽는다() {
        Employee employee = employee("ZZYE001");
        inputRepository.saveAndFlush(YearEndInput.create(employee, 2099, VALUES));
        entityManager.clear();

        YearEndInput found = inputRepository.findByEmployee_IdAndTaxYear(employee.getId(), 2099).orElseThrow();
        assertThat(found.toPersonalDeductionInput()).isEqualTo(VALUES);
        assertThat(found.getCreatedAt()).isNotNull();
        assertThat(inputRepository.findAllByTaxYear(2099)).hasSize(1);
        assertThat(inputRepository.findByEmployee_IdAndTaxYear(employee.getId(), 2098)).isEmpty();
    }

    @Test
    void 사원_연도당_하나만_저장된다() {
        Employee employee = employee("ZZYE002");
        inputRepository.saveAndFlush(YearEndInput.create(employee, 2099, VALUES));

        assertThatThrownBy(() -> inputRepository.saveAndFlush(YearEndInput.create(employee, 2099, VALUES)))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasStackTraceContaining("uk_year_end_input_employee_year");
    }

    @Test
    void DB는_배우자와_한부모_동시_선택을_거부한다() {
        Long id = employee("ZZYE003").getId();
        assertViolates(() -> insertRow(id, 2099, true, 1, 0, true, 0, 0), "ck_year_end_input_single_parent");
    }

    @Test
    void DB는_부양가족보다_많은_자녀와_출산_입양을_거부한다() {
        Long id = employee("ZZYE004").getId();
        assertViolates(() -> insertRow(id, 2099, false, 1, 0, false, 2, 0), "ck_year_end_input_child");
        assertViolates(() -> insertRow(id, 2098, false, 0, 0, false, 0, 1), "ck_year_end_input_birth");
    }

    @Test
    void DB는_기본공제_대상자보다_많은_경로우대를_거부한다() {
        Long id = employee("ZZYE005").getId();
        insertRow(id, 2097, true, 1, 3, false, 0, 0); // 본인 + 배우자 + 부양가족 1 = 3명
        assertViolates(() -> insertRow(id, 2099, true, 1, 4, false, 0, 0), "ck_year_end_input_elderly");
    }

    @Test
    void 입력_자료가_있는_사원_행은_삭제할_수_없다() {
        Employee employee = employee("ZZYE006");
        inputRepository.saveAndFlush(YearEndInput.create(employee, 2099, VALUES));

        assertViolates(() -> entityManager.createNativeQuery("DELETE FROM employee WHERE id = ?1")
                .setParameter(1, employee.getId()).executeUpdate(), "fk_year_end_input_employee");
    }
}
