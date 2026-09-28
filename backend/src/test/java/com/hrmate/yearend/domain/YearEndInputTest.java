package com.hrmate.yearend.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hrmate.employee.domain.Employee;
import com.hrmate.yearend.calculator.PersonalDeductionInput;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/** 연말정산 입력 자료 엔티티 규칙 (DB 접속 없음) */
class YearEndInputTest {

    private static final PersonalDeductionInput VALUES = new PersonalDeductionInput(true, 2, 1, 0, false, false, 1, 1, 0, 0);

    private static Employee employee() {
        return Employee.create("E2026001", "김가상", LocalDate.of(2020, 1, 1), "인사팀", "대리", null, null);
    }

    @Test
    void 생성하면_입력값을_그대로_보관하고_계산기_입력으로_되돌린다() {
        YearEndInput input = YearEndInput.create(employee(), 2025, VALUES);

        assertThat(input.getTaxYear()).isEqualTo(2025);
        assertThat(input.toPersonalDeductionInput()).isEqualTo(VALUES);
    }

    @Test
    void 수정하면_값_전체가_바뀐다() {
        YearEndInput input = YearEndInput.create(employee(), 2025, VALUES);

        input.change(PersonalDeductionInput.SELF_ONLY);

        assertThat(input.toPersonalDeductionInput()).isEqualTo(PersonalDeductionInput.SELF_ONLY);
    }

    @Test
    void 삭제된_사원이나_빈_값으로는_만들_수_없다() {
        Employee deleted = employee();
        deleted.delete();

        assertThatThrownBy(() -> YearEndInput.create(deleted, 2025, VALUES))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("삭제된 사원");
        assertThatThrownBy(() -> YearEndInput.create(employee(), 2025, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> YearEndInput.create(employee(), 2025, VALUES).change(null))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
