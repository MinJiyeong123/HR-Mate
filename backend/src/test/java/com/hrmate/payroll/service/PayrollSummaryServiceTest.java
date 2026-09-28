package com.hrmate.payroll.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hrmate.employee.domain.Employee;
import com.hrmate.employee.repository.EmployeeRepository;
import com.hrmate.global.error.BusinessException;
import com.hrmate.global.error.ErrorCode;
import com.hrmate.payroll.domain.PayItem;
import com.hrmate.payroll.domain.PayItemCategory;
import com.hrmate.payroll.domain.Payroll;
import com.hrmate.payroll.domain.PayrollLineInput;
import com.hrmate.payroll.domain.PayrollPeriod;
import com.hrmate.payroll.domain.PayrollPeriodStatus;
import com.hrmate.payroll.domain.TaxType;
import com.hrmate.payroll.dto.AnnualEmployeePayrollResponse;
import com.hrmate.payroll.dto.AnnualEmployeeSummaryResponse;
import com.hrmate.payroll.dto.AnnualPayrollSummaryResponse;
import com.hrmate.payroll.dto.AnnualTotals;
import com.hrmate.payroll.repository.PayrollPeriodRepository;
import com.hrmate.payroll.repository.PayrollRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

/** PayrollSummaryService 단위 테스트 (가짜 리포지토리 사용, DB 접속 없음). 금액은 모두 가상 값 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PayrollSummaryServiceTest {

    private static final PayItem BASE = item(1, "BASE_SALARY", "기본급", PayItemCategory.EARNING, TaxType.TAXABLE, 10);
    private static final PayItem MEAL = item(4, "MEAL_ALLOWANCE", "식대", PayItemCategory.EARNING, TaxType.NON_TAXABLE, 40);
    private static final PayItem TAX = item(6, "INCOME_TAX", "소득세", PayItemCategory.DEDUCTION, TaxType.NONE, 110);

    @Mock
    private PayrollRepository payrollRepository;

    @Mock
    private PayrollPeriodRepository periodRepository;

    @Mock
    private EmployeeRepository employeeRepository;

    @InjectMocks
    private PayrollSummaryService service;

    private long nextPayrollId = 100;

    private static PayItem item(long id, String code, String name, PayItemCategory category, TaxType taxType, int order) {
        PayItem item = PayItem.of(code, name, category, taxType, order);
        ReflectionTestUtils.setField(item, "id", id);
        return item;
    }

    private static PayrollPeriod period(int month, LocalDate paymentDate) {
        PayrollPeriod period = PayrollPeriod.create(2026, month, paymentDate);
        ReflectionTestUtils.setField(period, "id", (long) month);
        return period;
    }

    private static Employee employee(long id, String employeeNo, String department) {
        Employee employee = Employee.create(employeeNo, "김가상", LocalDate.of(2020, 1, 1), department, "대리", null, null);
        ReflectionTestUtils.setField(employee, "id", id);
        return employee;
    }

    /** 급여를 만든 뒤 기간을 확정한다. */
    private Payroll confirmedPayroll(PayrollPeriod period, Employee employee, long base, long meal, long tax) {
        Payroll payroll = Payroll.create(period, employee, List.of(
                new PayrollLineInput(TAX, tax), new PayrollLineInput(MEAL, meal), new PayrollLineInput(BASE, base)), null);
        ReflectionTestUtils.setField(payroll, "id", nextPayrollId++);
        period.confirm(1);
        return payroll;
    }

    private static void assertInvalidYear(Runnable action) {
        assertThatThrownBy(action::run)
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> {
                    assertThat(((BusinessException) e).getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT);
                    assertThat(((BusinessException) e).getFieldErrors()).containsKey("year");
                });
    }

    @Test
    void 연간_집계는_사원별로_묶고_과세_비과세를_나누며_마지막_급여의_사원_정보를_쓴다() {
        Employee kim = employee(7L, "E001", "인사팀");
        Employee lee = employee(8L, "E002", "개발팀");
        Payroll kimJan = confirmedPayroll(period(1, LocalDate.of(2026, 1, 25)), kim, 3_000_000, 200_000, 100_000);
        Payroll leeJan = confirmedPayroll(period(1, LocalDate.of(2026, 1, 25)), lee, 2_000_000, 0, 50_000);
        kim.updateBasicInfo("김가상", "재무팀", "과장", null, null);
        Payroll kimFeb = confirmedPayroll(period(2, LocalDate.of(2026, 2, 25)), kim, 3_000_000, 200_000, 100_000);
        lee.delete();

        when(payrollRepository.findAllForAnnual(2026, PayrollPeriodStatus.CONFIRMED)).thenReturn(List.of(kimJan, kimFeb, leeJan));
        when(periodRepository.countByPayYearAndStatus(2026, PayrollPeriodStatus.CONFIRMED)).thenReturn(2L);
        when(periodRepository.countByPayYearAndStatus(2026, PayrollPeriodStatus.DRAFT)).thenReturn(1L);

        AnnualPayrollSummaryResponse result = service.getAnnualSummary(2026);

        assertThat(result.year()).isEqualTo(2026);
        assertThat(result.confirmedPeriodCount()).isEqualTo(2);
        assertThat(result.excludedDraftPeriodCount()).isEqualTo(1);
        assertThat(result.totals()).isEqualTo(new AnnualTotals(8_400_000, 8_000_000, 400_000, 250_000, 8_150_000));

        assertThat(result.employees()).extracting(AnnualEmployeeSummaryResponse::employeeNo).containsExactly("E001", "E002");
        AnnualEmployeeSummaryResponse first = result.employees().get(0);
        assertThat(first.payrollCount()).isEqualTo(2);
        assertThat(first.department()).isEqualTo("재무팀");
        assertThat(first.position()).isEqualTo("과장");
        assertThat(first.deleted()).isFalse();
        assertThat(first.totals()).isEqualTo(new AnnualTotals(6_400_000, 6_000_000, 400_000, 200_000, 6_200_000));
        AnnualEmployeeSummaryResponse second = result.employees().get(1);
        assertThat(second.deleted()).isTrue();
        assertThat(second.totals()).isEqualTo(new AnnualTotals(2_000_000, 2_000_000, 0, 50_000, 1_950_000));
    }

    @Test
    void 확정_급여가_없는_연도는_합계_0과_빈_목록이다() {
        when(payrollRepository.findAllForAnnual(2026, PayrollPeriodStatus.CONFIRMED)).thenReturn(List.of());
        when(periodRepository.countByPayYearAndStatus(2026, PayrollPeriodStatus.DRAFT)).thenReturn(3L);

        AnnualPayrollSummaryResponse result = service.getAnnualSummary(2026);

        assertThat(result.totals()).isEqualTo(AnnualTotals.ZERO);
        assertThat(result.employees()).isEmpty();
        assertThat(result.excludedDraftPeriodCount()).isEqualTo(3);
    }

    @Test
    void 연도가_없거나_범위_밖이면_400이고_조회하지_않는다() {
        assertInvalidYear(() -> service.getAnnualSummary(null));
        assertInvalidYear(() -> service.getAnnualSummary(1999));
        assertInvalidYear(() -> service.getAnnualSummary(2101));
        assertInvalidYear(() -> service.getEmployeeAnnual(7L, 2101));

        verify(payrollRepository, never()).findAllForAnnual(anyInt(), any());
        verify(employeeRepository, never()).findById(any());
    }

    @Test
    void 사원별_상세에서_없는_사원은_404다() {
        when(employeeRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getEmployeeAnnual(99L, 2026))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.EMPLOYEE_NOT_FOUND);
    }

    @Test
    void 사원별_상세는_월별_지급일과_항목별_합계를_주고_삭제된_사원도_조회된다() {
        Employee kim = employee(7L, "E001", "인사팀");
        Payroll nov = confirmedPayroll(period(11, LocalDate.of(2026, 11, 25)), kim, 3_000_000, 200_000, 100_000);
        // 12월분을 다음 해 1월에 지급해도 귀속 연도(2026) 집계에 들어간다.
        Payroll dec = confirmedPayroll(period(12, LocalDate.of(2027, 1, 10)), kim, 3_100_000, 200_000, 110_000);
        kim.delete();

        when(employeeRepository.findById(7L)).thenReturn(Optional.of(kim));
        when(payrollRepository.findAllForAnnualByEmployee(7L, 2026, PayrollPeriodStatus.CONFIRMED)).thenReturn(List.of(nov, dec));
        when(payrollRepository.countByEmployee_IdAndPeriod_PayYearAndPeriod_Status(7L, 2026, PayrollPeriodStatus.DRAFT))
                .thenReturn(1L);

        AnnualEmployeePayrollResponse result = service.getEmployeeAnnual(7L, 2026);

        assertThat(result.deleted()).isTrue();
        assertThat(result.excludedDraftPayrollCount()).isEqualTo(1);
        assertThat(result.totals()).isEqualTo(new AnnualTotals(6_500_000, 6_100_000, 400_000, 210_000, 6_290_000));
        assertThat(result.months()).extracting(AnnualEmployeePayrollResponse.MonthlyPayroll::month).containsExactly(11, 12);
        assertThat(result.months().get(1).paymentDate()).isEqualTo(LocalDate.of(2027, 1, 10));
        assertThat(result.months().get(1).nonTaxableEarnings()).isEqualTo(200_000);
        assertThat(result.items()).extracting(AnnualEmployeePayrollResponse.ItemTotal::itemName)
                .containsExactly("기본급", "식대", "소득세");
        assertThat(result.items()).extracting(AnnualEmployeePayrollResponse.ItemTotal::amount)
                .containsExactly(6_100_000L, 400_000L, 210_000L);
    }

    @Test
    void 확정_급여가_없는_사원은_현재_사원_정보와_합계_0이다() {
        Employee kim = employee(7L, "E001", "인사팀");
        when(employeeRepository.findById(7L)).thenReturn(Optional.of(kim));
        when(payrollRepository.findAllForAnnualByEmployee(7L, 2026, PayrollPeriodStatus.CONFIRMED)).thenReturn(List.of());

        AnnualEmployeePayrollResponse result = service.getEmployeeAnnual(7L, 2026);

        assertThat(result.employeeNo()).isEqualTo("E001");
        assertThat(result.department()).isEqualTo("인사팀");
        assertThat(result.totals()).isEqualTo(AnnualTotals.ZERO);
        assertThat(result.months()).isEmpty();
        assertThat(result.items()).isEmpty();
    }
}
