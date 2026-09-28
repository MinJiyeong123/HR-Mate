package com.hrmate.payroll.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.hrmate.employee.domain.Employee;
import com.hrmate.employee.domain.EmploymentStatus;
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
import com.hrmate.payroll.dto.EligibleEmployeeResponse;
import com.hrmate.payroll.dto.PayrollPeriodCreateRequest;
import com.hrmate.payroll.dto.PayrollPeriodSummaryResponse;
import com.hrmate.payroll.dto.PayrollPeriodUpdateRequest;
import com.hrmate.payroll.repository.PayrollPeriodRepository;
import com.hrmate.payroll.repository.PayrollRepository;
import com.hrmate.payroll.repository.PayrollRepository.PeriodTotals;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

/** PayrollPeriodService 단위 테스트 (가짜 리포지토리 사용, DB 접속 없음) */
@ExtendWith(MockitoExtension.class)
class PayrollPeriodServiceTest {

    private static final LocalDate PAYMENT_DATE = LocalDate.of(2026, 4, 25);
    private static final PayItem BASE = PayItem.of("BASE_SALARY", "기본급", PayItemCategory.EARNING, TaxType.TAXABLE, 10);

    @Mock
    private PayrollPeriodRepository periodRepository;

    @Mock
    private PayrollRepository payrollRepository;

    @Mock
    private EmployeeRepository employeeRepository;

    @InjectMocks
    private PayrollPeriodService service;

    private static PayrollPeriod period(long id) {
        PayrollPeriod period = PayrollPeriod.create(2026, 4, PAYMENT_DATE);
        ReflectionTestUtils.setField(period, "id", id);
        return period;
    }

    private static Employee employee(long id, String employeeNo, LocalDate hireDate) {
        Employee employee = Employee.create(employeeNo, "가상" + id, hireDate, null, null, null, null);
        ReflectionTestUtils.setField(employee, "id", id);
        return employee;
    }

    private static Payroll payroll(PayrollPeriod period, Employee employee, long amount) {
        return Payroll.create(period, employee, List.of(new PayrollLineInput(BASE, amount)), null);
    }

    private static void assertErrorCode(Runnable action, ErrorCode expected) {
        assertThatThrownBy(action::run)
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(expected);
    }

    @Test
    void 목록은_집계_결과로_인원과_합계를_채운다() {
        PayrollPeriod april = period(1);
        PayrollPeriod may = period(2);
        when(periodRepository.findAllByOrderByPayYearDescPayMonthDesc()).thenReturn(List.of(may, april));
        when(payrollRepository.summarizeByPeriod()).thenReturn(List.of(totals(1L, 2, 5_000_000, 500_000)));

        List<PayrollPeriodSummaryResponse> result = service.getPeriods();

        assertThat(result).extracting(PayrollPeriodSummaryResponse::id).containsExactly(2L, 1L);
        assertThat(result.get(0).payrollCount()).isZero();
        assertThat(result.get(1).payrollCount()).isEqualTo(2);
        assertThat(result.get(1).totalNetPay()).isEqualTo(4_500_000);
    }

    @Test
    void 같은_연월_기간이_있으면_409다() {
        when(periodRepository.existsByPayYearAndPayMonth(2026, 4)).thenReturn(true);

        assertErrorCode(() -> service.createPeriod(new PayrollPeriodCreateRequest(2026, 4, PAYMENT_DATE)),
                ErrorCode.PAYROLL_PERIOD_DUPLICATED);
    }

    @Test
    void 동시에_생성되어_DB_중복_제약에_걸리면_409로_바꾼다() {
        when(periodRepository.saveAndFlush(any(PayrollPeriod.class)))
                .thenThrow(new DataIntegrityViolationException("Duplicate entry for key 'uk_payroll_period_year_month'"));

        assertErrorCode(() -> service.createPeriod(new PayrollPeriodCreateRequest(2026, 4, PAYMENT_DATE)),
                ErrorCode.PAYROLL_PERIOD_DUPLICATED);
    }

    @Test
    void 기간을_만들면_작성_중_상태이고_급여는_0건이다() {
        when(periodRepository.saveAndFlush(any(PayrollPeriod.class))).thenAnswer(invocation -> invocation.getArgument(0));

        PayrollPeriodSummaryResponse result = service.createPeriod(new PayrollPeriodCreateRequest(2026, 4, PAYMENT_DATE));

        assertThat(result.status()).isEqualTo(PayrollPeriodStatus.DRAFT);
        assertThat(result.payrollCount()).isZero();
    }

    @Test
    void 없는_기간은_404다() {
        when(periodRepository.findById(9L)).thenReturn(Optional.empty());

        assertErrorCode(() -> service.getPeriod(9L), ErrorCode.PAYROLL_PERIOD_NOT_FOUND);
        assertErrorCode(() -> service.confirm(9L), ErrorCode.PAYROLL_PERIOD_NOT_FOUND);
        assertErrorCode(() -> service.getEligibleEmployees(9L), ErrorCode.PAYROLL_PERIOD_NOT_FOUND);
    }

    @Test
    void 급여가_없으면_확정할_수_없다() {
        when(periodRepository.findById(1L)).thenReturn(Optional.of(period(1)));
        when(payrollRepository.countByPeriod_Id(1L)).thenReturn(0L);

        assertThatThrownBy(() -> service.confirm(1L))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> {
                    assertThat(((BusinessException) e).getErrorCode()).isEqualTo(ErrorCode.INVALID_PAYROLL_PERIOD_STATE);
                    assertThat(e.getMessage()).contains("1건 이상");
                });
    }

    @Test
    void 확정하고_확정_취소할_수_있다() {
        PayrollPeriod period = period(1);
        when(periodRepository.findById(1L)).thenReturn(Optional.of(period));
        when(payrollRepository.countByPeriod_Id(1L)).thenReturn(1L);

        assertThat(service.confirm(1L).status()).isEqualTo(PayrollPeriodStatus.CONFIRMED);
        assertErrorCode(() -> service.confirm(1L), ErrorCode.INVALID_PAYROLL_PERIOD_STATE);
        assertErrorCode(() -> service.updatePaymentDate(1L, new PayrollPeriodUpdateRequest(PAYMENT_DATE)),
                ErrorCode.PAYROLL_PERIOD_CONFIRMED);

        assertThat(service.reopen(1L).status()).isEqualTo(PayrollPeriodStatus.DRAFT);
        assertErrorCode(() -> service.reopen(1L), ErrorCode.INVALID_PAYROLL_PERIOD_STATE);
        assertThat(service.updatePaymentDate(1L, new PayrollPeriodUpdateRequest(PAYMENT_DATE.plusDays(1))).paymentDate())
                .isEqualTo(PAYMENT_DATE.plusDays(1));
    }

    @Test
    void 입력_가능한_사원은_해당_월_재직자_중_아직_급여가_없는_사원이다() {
        PayrollPeriod period = period(1);
        Employee paid = employee(1, "E001", LocalDate.of(2020, 1, 1));
        Employee eligible = employee(2, "E002", LocalDate.of(2026, 4, 30));
        Employee futureHire = employee(3, "E003", LocalDate.of(2026, 5, 1));
        Employee resignedBefore = employee(4, "E004", LocalDate.of(2020, 1, 1));
        resignedBefore.changeEmployment(LocalDate.of(2020, 1, 1), EmploymentStatus.RESIGNED, LocalDate.of(2026, 3, 31));
        Employee resignedInMonth = employee(5, "E005", LocalDate.of(2020, 1, 1));
        resignedInMonth.changeEmployment(LocalDate.of(2020, 1, 1), EmploymentStatus.RESIGNED, LocalDate.of(2026, 4, 1));

        when(periodRepository.findById(1L)).thenReturn(Optional.of(period));
        when(payrollRepository.findAllByPeriod_IdOrderByEmployeeNoAsc(1L)).thenReturn(List.of(payroll(period, paid, 1_000)));
        when(employeeRepository.findAllByDeletedAtIsNullOrderByEmployeeNoAsc())
                .thenReturn(List.of(paid, eligible, futureHire, resignedBefore, resignedInMonth));

        List<EligibleEmployeeResponse> result = service.getEligibleEmployees(1L);

        assertThat(result).extracting(EligibleEmployeeResponse::employeeNo).containsExactly("E002", "E005");
    }

    private static PeriodTotals totals(Long periodId, long count, long earnings, long deductions) {
        return new PeriodTotals() {
            public Long getPeriodId() {
                return periodId;
            }

            public long getPayrollCount() {
                return count;
            }

            public long getTotalEarnings() {
                return earnings;
            }

            public long getTotalDeductions() {
                return deductions;
            }

            public long getTotalNetPay() {
                return earnings - deductions;
            }
        };
    }
}
