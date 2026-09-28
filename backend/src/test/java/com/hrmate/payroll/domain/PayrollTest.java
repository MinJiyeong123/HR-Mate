package com.hrmate.payroll.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hrmate.employee.domain.Employee;
import com.hrmate.employee.domain.EmploymentStatus;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Payroll 규칙 단위 테스트 (DB 없이 실행) */
class PayrollTest {

    private static final PayItem BASE = PayItem.of("BASE_SALARY", "기본급", PayItemCategory.EARNING, TaxType.TAXABLE, 10);
    private static final PayItem BONUS = PayItem.of("BONUS", "상여금", PayItemCategory.EARNING, TaxType.TAXABLE, 30);
    private static final PayItem MEAL = PayItem.of("MEAL_ALLOWANCE", "식대", PayItemCategory.EARNING, TaxType.NON_TAXABLE, 40);
    private static final PayItem TAX = PayItem.of("INCOME_TAX", "소득세", PayItemCategory.DEDUCTION, TaxType.NONE, 110);
    private static final PayItem PENSION = PayItem.of("NATIONAL_PENSION", "국민연금", PayItemCategory.DEDUCTION, TaxType.NONE, 130);

    private static final YearMonth APRIL = YearMonth.of(2026, 4);

    private static PayrollPeriod april() {
        return PayrollPeriod.create(2026, 4, LocalDate.of(2026, 4, 25));
    }

    private static Employee employee(LocalDate hireDate) {
        return Employee.create("E2026001", "김가상", hireDate, "인사팀", "대리", null, null);
    }

    private static Employee resigned(LocalDate hireDate, LocalDate resignationDate) {
        Employee employee = employee(hireDate);
        employee.changeEmployment(hireDate, EmploymentStatus.RESIGNED, resignationDate);
        return employee;
    }

    private static PayrollLineInput line(PayItem item, Long amount) {
        return new PayrollLineInput(item, amount);
    }

    private static Payroll payroll(List<PayrollLineInput> lines) {
        return Payroll.create(april(), employee(LocalDate.of(2020, 1, 1)), lines, null);
    }

    @Test
    void 해당_월_재직_여부는_입사일과_퇴사일의_월_경계로_판단한다() {
        assertThat(Payroll.isEligible(employee(LocalDate.of(2026, 4, 30)), APRIL)).isTrue();   // 말일 입사
        assertThat(Payroll.isEligible(employee(LocalDate.of(2026, 5, 1)), APRIL)).isFalse();   // 다음 달 입사
        assertThat(Payroll.isEligible(resigned(LocalDate.of(2020, 1, 1), LocalDate.of(2026, 4, 1)), APRIL)).isTrue();    // 1일 퇴사
        assertThat(Payroll.isEligible(resigned(LocalDate.of(2020, 1, 1), LocalDate.of(2026, 3, 31)), APRIL)).isFalse();  // 전월 퇴사

        Employee deleted = employee(LocalDate.of(2020, 1, 1));
        deleted.delete();
        assertThat(Payroll.isEligible(deleted, APRIL)).isFalse();
    }

    @Test
    void 대상이_아닌_사원은_급여를_만들_수_없다() {
        assertThatThrownBy(() -> Payroll.create(april(), employee(LocalDate.of(2026, 5, 1)), List.of(line(BASE, 1L)), null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("재직한 사원");

        Employee deleted = employee(LocalDate.of(2020, 1, 1));
        deleted.delete();
        assertThatThrownBy(() -> Payroll.create(april(), deleted, List.of(line(BASE, 1L)), null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("삭제된 사원");
    }

    @Test
    void 생성하면_사원_정보를_복사하고_합계를_계산한다() {
        Payroll payroll = Payroll.create(april(), employee(LocalDate.of(2020, 1, 1)), List.of(
                line(BASE, 3_000_000L), line(MEAL, 200_000L), line(TAX, 100_000L), line(PENSION, 135_000L)), "  4월 급여  ");

        assertThat(payroll.getEmployeeNo()).isEqualTo("E2026001");
        assertThat(payroll.getEmployeeName()).isEqualTo("김가상");
        assertThat(payroll.getDepartment()).isEqualTo("인사팀");
        assertThat(payroll.getPosition()).isEqualTo("대리");
        assertThat(payroll.getTotalEarnings()).isEqualTo(3_200_000L);
        assertThat(payroll.getTotalDeductions()).isEqualTo(235_000L);
        assertThat(payroll.getNetPay()).isEqualTo(2_965_000L);
        assertThat(payroll.getMemo()).isEqualTo("4월 급여");
        assertThat(payroll.getLines()).extracting(PayrollLine::getItemName)
                .containsExactly("기본급", "식대", "소득세", "국민연금");
        assertThat(payroll.getLines()).filteredOn(l -> l.getItemName().equals("식대"))
                .extracting(PayrollLine::getTaxType).containsExactly(TaxType.NON_TAXABLE);
    }

    @Test
    void 영원이거나_비어_있는_항목은_저장하지_않는다() {
        Payroll payroll = payroll(List.of(line(BASE, 3_000_000L), line(BONUS, 0L), line(TAX, null)));

        assertThat(payroll.getLines()).extracting(PayrollLine::getItemName).containsExactly("기본급");
        assertThat(payroll.getTotalDeductions()).isZero();
        assertThat(payroll.getNetPay()).isEqualTo(3_000_000L);
    }

    @Test
    void 잘못된_항목_입력을_거부한다() {
        assertThatThrownBy(() -> payroll(List.of(line(TAX, 100L))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("지급 항목");
        assertThatThrownBy(() -> payroll(List.of(line(BASE, 0L))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("지급 항목");
        assertThatThrownBy(() -> payroll(List.of(line(BASE, 100L), line(BASE, 200L))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("두 번");
        assertThatThrownBy(() -> payroll(List.of(line(BASE, -1L))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("0원 이상");
        assertThatThrownBy(() -> payroll(List.of(line(BASE, 1_000_000_001L))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("1,000,000,000원");
        assertThat(payroll(List.of(line(BASE, 1_000_000_000L))).getTotalEarnings()).isEqualTo(1_000_000_000L);
    }

    @Test
    void 공제_합계가_지급_합계보다_크면_거부한다() {
        assertThatThrownBy(() -> payroll(List.of(line(BASE, 100_000L), line(TAX, 100_001L))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("공제 합계");

        Payroll zeroNet = payroll(List.of(line(BASE, 100_000L), line(TAX, 100_000L)));
        assertThat(zeroNet.getNetPay()).isZero();
    }

    @Test
    void 메모는_200자_이하다() {
        assertThatThrownBy(() -> Payroll.create(april(), employee(LocalDate.of(2020, 1, 1)),
                List.of(line(BASE, 1L)), "가".repeat(201)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 항목을_바꾸면_같은_항목은_금액만_바뀌고_빠진_항목은_삭제된다() {
        Payroll payroll = payroll(List.of(line(BASE, 3_000_000L), line(MEAL, 200_000L), line(TAX, 100_000L)));
        PayrollLine baseLine = payroll.getLines().get(0);

        payroll.changeLines(List.of(line(BASE, 3_100_000L), line(BONUS, 500_000L), line(TAX, 120_000L)));

        assertThat(payroll.getLines()).extracting(PayrollLine::getItemName)
                .containsExactlyInAnyOrder("기본급", "상여금", "소득세");
        assertThat(payroll.getLines()).contains(baseLine); // 같은 객체를 금액만 변경
        assertThat(baseLine.getAmount()).isEqualTo(3_100_000L);
        assertThat(payroll.getTotalEarnings()).isEqualTo(3_600_000L);
        assertThat(payroll.getNetPay()).isEqualTo(3_480_000L);
    }

    @Test
    void 확정된_기간의_급여는_만들거나_바꾸거나_지울_수_없다() {
        PayrollPeriod period = april();
        Payroll payroll = Payroll.create(period, employee(LocalDate.of(2020, 1, 1)), List.of(line(BASE, 1_000L)), null);
        period.confirm(1);

        assertThatThrownBy(() -> payroll.changeLines(List.of(line(BASE, 2_000L)))).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> payroll.changeMemo("변경")).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(payroll::assertDeletable).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> Payroll.create(period, employee(LocalDate.of(2020, 1, 1)), List.of(line(BASE, 1L)), null))
                .isInstanceOf(IllegalStateException.class);
        assertThat(payroll.getTotalEarnings()).isEqualTo(1_000L);
    }

    @Test
    void 분류와_과세_구분이_맞지_않는_항목은_만들_수_없다() {
        assertThatThrownBy(() -> PayItem.of("X", "잘못", PayItemCategory.EARNING, TaxType.NONE, 1))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PayItem.of("Y", "잘못", PayItemCategory.DEDUCTION, TaxType.TAXABLE, 1))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
