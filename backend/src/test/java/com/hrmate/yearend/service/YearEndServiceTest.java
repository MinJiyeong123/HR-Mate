package com.hrmate.yearend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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
import com.hrmate.payroll.repository.PayrollRepository;
import com.hrmate.yearend.calculator.PersonalDeductionInput;
import com.hrmate.yearend.domain.YearEndInput;
import com.hrmate.yearend.dto.YearEndEmployeeSummaryResponse;
import com.hrmate.yearend.dto.YearEndInputRequest;
import com.hrmate.yearend.dto.YearEndInputResponse;
import com.hrmate.yearend.dto.YearEndResultResponse;
import com.hrmate.yearend.repository.YearEndInputRepository;
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

/** YearEndService 단위 테스트 (가짜 리포지토리 사용, DB 접속 없음). 금액은 모두 가상 값 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class YearEndServiceTest {

    private static final PayItem BASE = item(1, "BASE_SALARY", PayItemCategory.EARNING, TaxType.TAXABLE, 10);
    private static final PayItem MEAL = item(4, "MEAL_ALLOWANCE", PayItemCategory.EARNING, TaxType.NON_TAXABLE, 40);
    private static final PayItem INCOME_TAX = item(6, "INCOME_TAX", PayItemCategory.DEDUCTION, TaxType.NONE, 110);
    private static final PayItem PENSION = item(8, "NATIONAL_PENSION", PayItemCategory.DEDUCTION, TaxType.NONE, 130);
    private static final PayItem HEALTH = item(9, "HEALTH_INSURANCE", PayItemCategory.DEDUCTION, TaxType.NONE, 140);
    private static final PayItem CARE = item(10, "LONG_TERM_CARE", PayItemCategory.DEDUCTION, TaxType.NONE, 150);
    private static final PayItem EMPLOYMENT = item(11, "EMPLOYMENT_INSURANCE", PayItemCategory.DEDUCTION, TaxType.NONE, 160);

    private static final YearEndInputRequest VALID_REQUEST =
            new YearEndInputRequest(true, 1, 0, 0, false, false, 1, 0, 0, 0);

    @Mock
    private PayrollRepository payrollRepository;

    @Mock
    private YearEndInputRepository inputRepository;

    @Mock
    private EmployeeRepository employeeRepository;

    @InjectMocks
    private YearEndService service;

    private static PayItem item(long id, String code, PayItemCategory category, TaxType taxType, int order) {
        PayItem item = PayItem.of(code, code, category, taxType, order);
        ReflectionTestUtils.setField(item, "id", id);
        return item;
    }

    private static Employee employee(long id, String employeeNo) {
        Employee employee = Employee.create(employeeNo, "김가상", LocalDate.of(2020, 1, 1), "인사팀", "대리", null, null);
        ReflectionTestUtils.setField(employee, "id", id);
        return employee;
    }

    /** 기본급 300만, 식대, 건강 10만, 장기요양 1만, 고용 2만, 국민연금 13만5천, 소득세 5만 → 기간 확정 */
    private static Payroll confirmedPayroll(Employee employee, int month, long meal) {
        return confirmedPayroll(2025, employee, month, meal);
    }

    private static Payroll confirmedPayroll(int year, Employee employee, int month, long meal) {
        PayrollPeriod period = PayrollPeriod.create(year, month, LocalDate.of(year, month, 25));
        Payroll payroll = Payroll.create(period, employee, List.of(
                new PayrollLineInput(BASE, 3_000_000L), new PayrollLineInput(MEAL, meal),
                new PayrollLineInput(HEALTH, 100_000L), new PayrollLineInput(CARE, 10_000L),
                new PayrollLineInput(EMPLOYMENT, 20_000L), new PayrollLineInput(PENSION, 135_000L),
                new PayrollLineInput(INCOME_TAX, 50_000L)), null);
        period.confirm(1);
        return payroll;
    }

    private static void assertErrorCode(Runnable action, ErrorCode expected) {
        assertThatThrownBy(action::run)
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(expected);
    }

    @Test
    void 계산_결과는_확정_급여를_항목별로_합산하고_급여_안내를_붙인다() {
        Employee kim = employee(7L, "E001");
        when(employeeRepository.findById(7L)).thenReturn(Optional.of(kim));
        when(payrollRepository.findAllForAnnualByEmployee(7L, 2025, PayrollPeriodStatus.CONFIRMED))
                .thenReturn(List.of(confirmedPayroll(kim, 1, 200_000), confirmedPayroll(kim, 2, 250_000)));
        when(payrollRepository.countByEmployee_IdAndPeriod_PayYearAndPeriod_Status(7L, 2025, PayrollPeriodStatus.DRAFT))
                .thenReturn(1L);
        when(inputRepository.findByEmployee_IdAndTaxYear(7L, 2025)).thenReturn(Optional.empty());

        YearEndResultResponse result = service.getResult(7L, 2025);

        assertThat(result.calculable()).isTrue();
        assertThat(result.notice()).isEqualTo(YearEndService.NOTICE);
        assertThat(result.payrollCount()).isEqualTo(2);
        assertThat(result.sources()).isEqualTo(new YearEndResultResponse.Sources(
                6_000_000, 450_000, 200_000, 20_000, 40_000, 270_000, 100_000));
        // 총급여 600만 → 근로소득공제 350만 + 100만 × 40% = 390만, 근로소득금액 210만
        // − 본인 150만 − 보험료 26만 − 국민연금 27만 = 과세표준 7만 → 산출세액 4,200
        // 근로소득세액공제 4,200 × 55% = 2,310 → 결정세액 1,890 − 기납부 10만 = −98,110 (환급)
        assertThat(result.calculation().taxBase()).isEqualTo(70_000);
        assertThat(result.calculation().determinedTax()).isEqualTo(1_890);
        assertThat(result.calculation().refund()).isEqualTo(98_110);
        assertThat(result.warnings()).containsExactly(
                "연말정산 입력 자료가 없어 본인 기본공제만 적용했습니다.",
                "식대가 월 20만원을 넘는 달이 있습니다(2월). 비과세 한도 초과분의 과세 전환은 반영하지 않았습니다.",
                "작성 중인 급여 1건은 계산에서 제외했습니다.");
        assertThat(result.assumptions()).hasSize(3);
    }

    @Test
    void 연도_2026_결과는_규칙_안내를_붙이고_자녀가_있을_때만_2017년생_주의를_붙인다() {
        Employee kim = employee(7L, "E001");
        Employee lee = employee(8L, "E002");
        when(employeeRepository.findById(7L)).thenReturn(Optional.of(kim));
        when(employeeRepository.findById(8L)).thenReturn(Optional.of(lee));
        when(payrollRepository.findAllForAnnualByEmployee(7L, 2026, PayrollPeriodStatus.CONFIRMED))
                .thenReturn(List.of(confirmedPayroll(2026, kim, 1, 0)));
        when(payrollRepository.findAllForAnnualByEmployee(8L, 2026, PayrollPeriodStatus.CONFIRMED))
                .thenReturn(List.of(confirmedPayroll(2026, lee, 1, 0)));
        // 7: 자녀세액공제 대상 자녀 1명 / 8: 자녀 0명
        when(inputRepository.findByEmployee_IdAndTaxYear(7L, 2026)).thenReturn(Optional.of(
                YearEndInput.create(kim, 2026, new PersonalDeductionInput(false, 1, 0, 0, false, false, 1, 0, 0, 0))));
        when(inputRepository.findByEmployee_IdAndTaxYear(8L, 2026)).thenReturn(Optional.of(
                YearEndInput.create(lee, 2026, PersonalDeductionInput.SELF_ONLY)));

        YearEndResultResponse withChild = service.getResult(7L, 2026);
        YearEndResultResponse noChild = service.getResult(8L, 2026);

        assertThat(withChild.calculation().rulesYear()).isEqualTo(2026);
        assertThat(withChild.warnings()).anyMatch(w -> w.contains("법률 제21548호") && w.contains("국세청 2026년 귀속 안내는 확인하지 못했고"));
        assertThat(withChild.warnings()).anyMatch(w -> w.contains("2017년생") && w.contains("해석 미확정"));
        assertThat(withChild.warnings()).noneMatch(w -> w.contains("2025년 귀속 규칙을 적용한 결과"));
        assertThat(noChild.warnings()).anyMatch(w -> w.contains("법률 제21548호"));
        assertThat(noChild.warnings()).noneMatch(w -> w.contains("2017년생"));
    }

    @Test
    void 입력_조회는_귀속연도별_자녀_연령_안내를_돌려준다() {
        Employee kim = employee(7L, "E001");
        when(employeeRepository.findById(7L)).thenReturn(Optional.of(kim));
        when(inputRepository.findByEmployee_IdAndTaxYear(any(), anyInt())).thenReturn(Optional.empty());

        YearEndInputResponse y2025 = service.getInput(7L, 2025);
        YearEndInputResponse y2026 = service.getInput(7L, 2026);
        YearEndInputResponse y2027 = service.getInput(7L, 2027);
        YearEndInputResponse y2024 = service.getInput(7L, 2024);

        assertThat(y2025.childCreditMinimumAge()).isEqualTo(8);
        assertThat(y2025.childCreditAgeCaution()).isNull();
        assertThat(y2026.childCreditMinimumAge()).isEqualTo(9);
        assertThat(y2026.childCreditAgeCaution()).contains("2017년생");
        assertThat(y2027.childCreditMinimumAge()).isEqualTo(10);
        assertThat(y2027.childCreditAgeBasis()).startsWith("참고:").contains("2025년 귀속 규칙으로 대체");
        assertThat(y2024.childCreditMinimumAge()).isNull();
        assertThat(y2024.childCreditAgeBasis()).startsWith("이 연도의 나이 기준은 확인하지 않았습니다.");
    }

    @Test
    void 확정_급여가_없으면_계산하지_않고_퇴사자_안내를_붙인다() {
        Employee kim = employee(7L, "E001");
        kim.changeEmployment(LocalDate.of(2020, 1, 1), EmploymentStatus.RESIGNED, LocalDate.of(2024, 12, 31));
        when(employeeRepository.findById(7L)).thenReturn(Optional.of(kim));
        when(payrollRepository.findAllForAnnualByEmployee(7L, 2025, PayrollPeriodStatus.CONFIRMED)).thenReturn(List.of());

        YearEndResultResponse result = service.getResult(7L, 2025);

        assertThat(result.calculable()).isFalse();
        assertThat(result.calculation()).isNull();
        assertThat(result.sources()).isNull();
        assertThat(result.employee().resigned()).isTrue();
        assertThat(result.warnings()).containsExactly(
                "확정된 급여가 없어 계산할 수 없습니다.",
                "퇴사한 사원입니다. 중도 퇴사자 정산 방식은 반영하지 않았습니다.");
    }

    @Test
    void 목록은_사원별로_계산하고_입력_저장_여부를_표시한다() {
        Employee kim = employee(7L, "E001");
        Employee lee = employee(8L, "E002");
        when(payrollRepository.findAllForAnnual(2025, PayrollPeriodStatus.CONFIRMED))
                .thenReturn(List.of(confirmedPayroll(kim, 1, 0), confirmedPayroll(lee, 1, 0)));
        when(inputRepository.findAllByTaxYear(2025)).thenReturn(List.of(
                YearEndInput.create(kim, 2025, PersonalDeductionInput.SELF_ONLY)));

        List<YearEndEmployeeSummaryResponse> result = service.getEmployees(2025);

        assertThat(result).extracting(YearEndEmployeeSummaryResponse::employeeNo).containsExactly("E001", "E002");
        assertThat(result).extracting(YearEndEmployeeSummaryResponse::inputSaved).containsExactly(true, false);
        assertThat(result.get(0).totalSalary()).isEqualTo(3_000_000);
        assertThat(result.get(0).prepaidTax()).isEqualTo(50_000);
    }

    @Test
    void 입력_저장은_없으면_만들고_있으면_바꾼다() {
        Employee kim = employee(7L, "E001");
        when(employeeRepository.findById(7L)).thenReturn(Optional.of(kim));
        when(inputRepository.saveAndFlush(any(YearEndInput.class))).thenAnswer(invocation -> invocation.getArgument(0));

        when(inputRepository.findByEmployee_IdAndTaxYear(7L, 2025)).thenReturn(Optional.empty());
        YearEndInputResponse created = service.saveInput(7L, 2025, VALID_REQUEST);
        assertThat(created.saved()).isTrue();
        assertThat(created.spouseDeduction()).isTrue();
        assertThat(created.childCreditCount()).isEqualTo(1);

        YearEndInput existing = YearEndInput.create(kim, 2025, PersonalDeductionInput.SELF_ONLY);
        when(inputRepository.findByEmployee_IdAndTaxYear(7L, 2025)).thenReturn(Optional.of(existing));
        service.saveInput(7L, 2025, VALID_REQUEST);
        assertThat(existing.toPersonalDeductionInput().dependentCount()).isEqualTo(1);
    }

    @Test
    void 입력_저장_규칙_위반() {
        Employee kim = employee(7L, "E001");
        Employee deleted = employee(8L, "E002");
        deleted.delete();
        when(employeeRepository.findById(7L)).thenReturn(Optional.of(kim));
        when(employeeRepository.findById(8L)).thenReturn(Optional.of(deleted));
        when(employeeRepository.findById(99L)).thenReturn(Optional.empty());

        // 삭제된 사원 409, 없는 사원 404
        assertErrorCode(() -> service.saveInput(8L, 2025, VALID_REQUEST), ErrorCode.YEAR_END_INPUT_LOCKED);
        assertErrorCode(() -> service.saveInput(99L, 2025, VALID_REQUEST), ErrorCode.EMPLOYEE_NOT_FOUND);

        // 배우자 + 한부모 동시 선택 → fieldErrors.input
        YearEndInputRequest invalid = new YearEndInputRequest(true, 1, 0, 0, false, true, 0, 0, 0, 0);
        assertThatThrownBy(() -> service.saveInput(7L, 2025, invalid))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> {
                    assertThat(((BusinessException) e).getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT);
                    assertThat(((BusinessException) e).getFieldErrors()).containsKey("input");
                });
        verify(inputRepository, never()).saveAndFlush(any());
    }

    @Test
    void 삭제된_사원의_입력은_조회만_가능하다() {
        Employee deleted = employee(8L, "E002");
        deleted.delete();
        when(employeeRepository.findById(8L)).thenReturn(Optional.of(deleted));
        when(inputRepository.findByEmployee_IdAndTaxYear(8L, 2025)).thenReturn(Optional.empty());

        YearEndInputResponse response = service.getInput(8L, 2025);

        assertThat(response.saved()).isFalse();
        assertThat(response.editable()).isFalse();
        assertThat(response.dependentCount()).isZero();
    }

    @Test
    void 연도가_범위를_벗어나면_400이고_조회하지_않는다() {
        assertErrorCode(() -> service.getEmployees(1999), ErrorCode.INVALID_INPUT);
        assertErrorCode(() -> service.getResult(7L, 2101), ErrorCode.INVALID_INPUT);
        assertErrorCode(() -> service.getInput(7L, null), ErrorCode.INVALID_INPUT);

        verify(payrollRepository, never()).findAllForAnnual(anyInt(), any());
        verify(employeeRepository, never()).findById(any());
    }
}
