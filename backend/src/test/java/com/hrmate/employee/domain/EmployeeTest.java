package com.hrmate.employee.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/** Employee 엔티티 규칙 단위 테스트 (DB 없이 실행) */
class EmployeeTest {

    private static final LocalDate HIRE_DATE = LocalDate.of(2024, 3, 4);

    private Employee newEmployee() {
        return Employee.create("E2024001", "테스트", HIRE_DATE, null, null, null, null);
    }

    @Test
    void 생성하면_사번은_대문자로_저장되고_재직_상태로_시작한다() {
        Employee employee = Employee.create("e2024abc", "  김가상  ", HIRE_DATE, " 인사팀 ", "", null, "test@example.com");

        assertThat(employee.getEmployeeNo()).isEqualTo("E2024ABC");
        assertThat(employee.getName()).isEqualTo("김가상");
        assertThat(employee.getDepartment()).isEqualTo("인사팀");
        assertThat(employee.getPosition()).isNull();
        assertThat(employee.getEmploymentStatus()).isEqualTo(EmploymentStatus.ACTIVE);
        assertThat(employee.getResignationDate()).isNull();
        assertThat(employee.isDeleted()).isFalse();
    }

    @Test
    void 사번_형식이_맞지_않으면_거부한다() {
        assertThatThrownBy(() -> Employee.normalizeEmployeeNo("E 001"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("사번은 공백 없이 영문·숫자 20자 이내로 입력해 주세요.");
        assertThatThrownBy(() -> Employee.normalizeEmployeeNo("E-001")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Employee.normalizeEmployeeNo("사번001")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Employee.normalizeEmployeeNo("")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Employee.normalizeEmployeeNo("A".repeat(21))).isInstanceOf(IllegalArgumentException.class);
        assertThat(Employee.normalizeEmployeeNo("a".repeat(20))).isEqualTo("A".repeat(20));
    }

    @Test
    void 이름과_입사일은_필수다() {
        assertThatThrownBy(() -> Employee.create("E1", " ", HIRE_DATE, null, null, null, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Employee.create("E1", "테스트", null, null, null, null, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 재직_상태에서는_퇴사일을_입력할_수_없다() {
        Employee employee = newEmployee();

        assertThatThrownBy(() -> employee.changeEmployment(HIRE_DATE, EmploymentStatus.ACTIVE, HIRE_DATE.plusDays(1)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("퇴사일을 비워야");
    }

    @Test
    void 퇴사_상태에서는_퇴사일이_필수이고_입사일_이후여야_한다() {
        Employee employee = newEmployee();

        assertThatThrownBy(() -> employee.changeEmployment(HIRE_DATE, EmploymentStatus.RESIGNED, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> employee.changeEmployment(HIRE_DATE, EmploymentStatus.RESIGNED, HIRE_DATE.minusDays(1)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("입사일보다 빠를 수 없습니다");

        employee.changeEmployment(HIRE_DATE, EmploymentStatus.RESIGNED, HIRE_DATE);
        assertThat(employee.getEmploymentStatus()).isEqualTo(EmploymentStatus.RESIGNED);
        assertThat(employee.getResignationDate()).isEqualTo(HIRE_DATE);
    }

    @Test
    void 입사일을_기존_퇴사일보다_늦게_바꾸면_거부한다() {
        Employee employee = newEmployee();
        employee.changeEmployment(HIRE_DATE, EmploymentStatus.RESIGNED, HIRE_DATE.plusMonths(1));

        assertThatThrownBy(() -> employee.changeEmployment(
                HIRE_DATE.plusMonths(2), EmploymentStatus.RESIGNED, HIRE_DATE.plusMonths(1)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 퇴사에서_재직으로_되돌릴_수_있다() {
        Employee employee = newEmployee();
        employee.changeEmployment(HIRE_DATE, EmploymentStatus.RESIGNED, HIRE_DATE.plusYears(1));

        employee.changeEmployment(HIRE_DATE, EmploymentStatus.ACTIVE, null);

        assertThat(employee.getEmploymentStatus()).isEqualTo(EmploymentStatus.ACTIVE);
        assertThat(employee.getResignationDate()).isNull();
    }

    @Test
    void 논리_삭제된_사원은_수정하거나_다시_삭제할_수_없다() {
        Employee employee = newEmployee();
        employee.delete();

        assertThat(employee.isDeleted()).isTrue();
        assertThat(employee.getDeletedAt()).isNotNull();
        assertThatThrownBy(() -> employee.updateBasicInfo("새이름", null, null, null, null))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> employee.changeEmployment(HIRE_DATE, EmploymentStatus.ACTIVE, null))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(employee::delete).isInstanceOf(IllegalStateException.class);
    }
}
