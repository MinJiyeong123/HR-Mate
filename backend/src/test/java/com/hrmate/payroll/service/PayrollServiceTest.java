package com.hrmate.payroll.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
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
import com.hrmate.payroll.domain.TaxType;
import com.hrmate.payroll.dto.PayrollCreateRequest;
import com.hrmate.payroll.dto.PayrollDetailResponse;
import com.hrmate.payroll.dto.PayrollLineRequest;
import com.hrmate.payroll.dto.PayrollUpdateRequest;
import com.hrmate.payroll.repository.PayItemRepository;
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
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

/** PayrollService 단위 테스트 (가짜 리포지토리 사용, DB 접속 없음) */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PayrollServiceTest {

    private static final PayItem BASE = item(1, "BASE_SALARY", "기본급", PayItemCategory.EARNING, TaxType.TAXABLE, 10);
    private static final PayItem MEAL = item(4, "MEAL_ALLOWANCE", "식대", PayItemCategory.EARNING, TaxType.NON_TAXABLE, 40);
    private static final PayItem TAX = item(6, "INCOME_TAX", "소득세", PayItemCategory.DEDUCTION, TaxType.NONE, 110);

    @Mock
    private PayrollRepository payrollRepository;

    @Mock
    private PayrollPeriodRepository periodRepository;

    @Mock
    private PayItemRepository payItemRepository;

    @Mock
    private EmployeeRepository employeeRepository;

    @InjectMocks
    private PayrollService service;

    private static PayItem item(long id, String code, String name, PayItemCategory category, TaxType taxType, int order) {
        PayItem item = PayItem.of(code, name, category, taxType, order);
        ReflectionTestUtils.setField(item, "id", id);
        return item;
    }

    private static PayrollPeriod period() {
        PayrollPeriod period = PayrollPeriod.create(2026, 4, LocalDate.of(2026, 4, 25));
        ReflectionTestUtils.setField(period, "id", 1L);
        return period;
    }

    private static Employee employee(LocalDate hireDate) {
        Employee employee = Employee.create("E2026001", "김가상", hireDate, "인사팀", "대리", null, null);
        ReflectionTestUtils.setField(employee, "id", 7L);
        return employee;
    }

    private static PayrollCreateRequest createRequest(PayrollLineRequest... lines) {
        return new PayrollCreateRequest(7L, List.of(lines), "4월");
    }

    private static PayrollLineRequest line(long payItemId, long amount) {
        return new PayrollLineRequest(payItemId, amount);
    }

    private static void assertErrorCode(Runnable action, ErrorCode expected) {
        assertThatThrownBy(action::run)
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(expected);
    }

    private void givenPeriodAndEmployee(PayrollPeriod period, Employee employee) {
        when(periodRepository.findById(1L)).thenReturn(Optional.of(period));
        when(employeeRepository.findById(7L)).thenReturn(Optional.of(employee));
        when(payItemRepository.findAllById(anyList())).thenReturn(List.of(BASE, MEAL, TAX));
    }

    @Test
    void 급여를_입력하면_서버가_합계를_계산하고_항목을_순서대로_돌려준다() {
        givenPeriodAndEmployee(period(), employee(LocalDate.of(2020, 1, 1)));
        when(payrollRepository.saveAndFlush(any(Payroll.class))).thenAnswer(invocation -> invocation.getArgument(0));

        PayrollDetailResponse result = service.createPayroll(1L,
                createRequest(line(6, 100_000), line(4, 200_000), line(1, 3_000_000)));

        assertThat(result.totalEarnings()).isEqualTo(3_200_000);
        assertThat(result.totalDeductions()).isEqualTo(100_000);
        assertThat(result.netPay()).isEqualTo(3_100_000);
        assertThat(result.earnings()).extracting("itemName").containsExactly("기본급", "식대");
        assertThat(result.deductions()).extracting("itemName").containsExactly("소득세");
        assertThat(result.employeeNo()).isEqualTo("E2026001");
    }

    @Test
    void 없는_기간과_없는_사원은_404다() {
        when(periodRepository.findById(1L)).thenReturn(Optional.empty());
        assertErrorCode(() -> service.createPayroll(1L, createRequest(line(1, 1_000))), ErrorCode.PAYROLL_PERIOD_NOT_FOUND);

        when(periodRepository.findById(1L)).thenReturn(Optional.of(period()));
        when(employeeRepository.findById(7L)).thenReturn(Optional.empty());
        assertErrorCode(() -> service.createPayroll(1L, createRequest(line(1, 1_000))), ErrorCode.EMPLOYEE_NOT_FOUND);
    }

    @Test
    void 확정된_기간에는_입력할_수_없다() {
        PayrollPeriod period = period();
        period.confirm(1);
        givenPeriodAndEmployee(period, employee(LocalDate.of(2020, 1, 1)));

        assertErrorCode(() -> service.createPayroll(1L, createRequest(line(1, 1_000))), ErrorCode.PAYROLL_PERIOD_CONFIRMED);
    }

    @Test
    void 재직하지_않았거나_삭제된_사원은_400이다() {
        givenPeriodAndEmployee(period(), employee(LocalDate.of(2026, 5, 1)));
        assertErrorCode(() -> service.createPayroll(1L, createRequest(line(1, 1_000))), ErrorCode.EMPLOYEE_NOT_ELIGIBLE);

        Employee deleted = employee(LocalDate.of(2020, 1, 1));
        deleted.delete();
        when(employeeRepository.findById(7L)).thenReturn(Optional.of(deleted));
        assertErrorCode(() -> service.createPayroll(1L, createRequest(line(1, 1_000))), ErrorCode.EMPLOYEE_NOT_ELIGIBLE);
    }

    @Test
    void 이미_급여가_있는_사원은_409다() {
        givenPeriodAndEmployee(period(), employee(LocalDate.of(2020, 1, 1)));
        when(payrollRepository.existsByPeriod_IdAndEmployee_Id(1L, 7L)).thenReturn(true);

        assertErrorCode(() -> service.createPayroll(1L, createRequest(line(1, 1_000))), ErrorCode.PAYROLL_DUPLICATED);
    }

    @Test
    void 동시에_입력되어_DB_중복_제약에_걸리면_409로_바꾼다() {
        givenPeriodAndEmployee(period(), employee(LocalDate.of(2020, 1, 1)));
        when(payrollRepository.saveAndFlush(any(Payroll.class)))
                .thenThrow(new DataIntegrityViolationException("Duplicate entry for key 'uk_payroll_period_employee'"));

        assertErrorCode(() -> service.createPayroll(1L, createRequest(line(1, 1_000))), ErrorCode.PAYROLL_DUPLICATED);
    }

    @Test
    void 없는_항목과_규칙_위반은_lines_항목_오류다() {
        givenPeriodAndEmployee(period(), employee(LocalDate.of(2020, 1, 1)));

        assertThatThrownBy(() -> service.createPayroll(1L, createRequest(line(99, 1_000))))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getFieldErrors()).containsKey("lines"));

        assertThatThrownBy(() -> service.createPayroll(1L, createRequest(line(1, 100), line(6, 200))))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> {
                    BusinessException be = (BusinessException) e;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT);
                    assertThat(be.getFieldErrors().get("lines")).contains("공제 합계");
                });
        verify(payrollRepository, never()).saveAndFlush(any());
    }

    @Test
    void 확정된_기간의_급여는_수정하거나_삭제할_수_없다() {
        PayrollPeriod period = period();
        Payroll payroll = Payroll.create(period, employee(LocalDate.of(2020, 1, 1)),
                List.of(new PayrollLineInput(BASE, 1_000L)), null);
        period.confirm(1);
        when(payrollRepository.findById(10L)).thenReturn(Optional.of(payroll));

        assertErrorCode(() -> service.updatePayroll(10L, new PayrollUpdateRequest(List.of(line(1, 2_000)), null)),
                ErrorCode.PAYROLL_PERIOD_CONFIRMED);
        assertErrorCode(() -> service.deletePayroll(10L), ErrorCode.PAYROLL_PERIOD_CONFIRMED);
        verify(payrollRepository, never()).delete(any());
    }

    @Test
    void 작성_중인_급여는_수정하고_삭제할_수_있다() {
        Payroll payroll = Payroll.create(period(), employee(LocalDate.of(2020, 1, 1)),
                List.of(new PayrollLineInput(BASE, 1_000L)), null);
        when(payrollRepository.findById(10L)).thenReturn(Optional.of(payroll));
        when(payItemRepository.findAllById(anyList())).thenReturn(List.of(BASE, TAX));

        PayrollDetailResponse updated = service.updatePayroll(10L,
                new PayrollUpdateRequest(List.of(line(1, 2_000), line(6, 500)), "수정"));
        assertThat(updated.netPay()).isEqualTo(1_500);
        assertThat(updated.memo()).isEqualTo("수정");

        service.deletePayroll(10L);
        verify(payrollRepository).delete(payroll);
    }

    @Test
    void 없는_급여는_404다() {
        when(payrollRepository.findById(10L)).thenReturn(Optional.empty());

        assertErrorCode(() -> service.getPayroll(10L), ErrorCode.PAYROLL_NOT_FOUND);
        assertErrorCode(() -> service.deletePayroll(10L), ErrorCode.PAYROLL_NOT_FOUND);
    }

    @Test
    void 사원별_연간_내역은_연도를_검사하고_삭제된_사원은_404다() {
        assertThatThrownBy(() -> service.getEmployeePayrolls(7L, 1999))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getFieldErrors()).containsKey("year"));

        when(employeeRepository.findByIdAndDeletedAtIsNull(7L)).thenReturn(Optional.empty());
        assertErrorCode(() -> service.getEmployeePayrolls(7L, 2026), ErrorCode.EMPLOYEE_NOT_FOUND);
    }
}
