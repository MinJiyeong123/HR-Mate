package com.hrmate.yearend.service;

import com.hrmate.employee.domain.Employee;
import com.hrmate.employee.domain.EmploymentStatus;
import com.hrmate.employee.repository.EmployeeRepository;
import com.hrmate.global.error.BusinessException;
import com.hrmate.global.error.ErrorCode;
import com.hrmate.payroll.domain.Payroll;
import com.hrmate.payroll.domain.PayrollPeriodStatus;
import com.hrmate.payroll.repository.PayrollRepository;
import com.hrmate.yearend.calculator.ChildCreditAgeGuide;
import com.hrmate.yearend.calculator.PersonalDeductionInput;
import com.hrmate.yearend.calculator.YearEndCalculationInput;
import com.hrmate.yearend.calculator.YearEndCalculationResult;
import com.hrmate.yearend.calculator.YearEndCalculator;
import com.hrmate.yearend.domain.YearEndInput;
import com.hrmate.yearend.domain.YearEndPayrollTotals;
import com.hrmate.yearend.dto.YearEndEmployeeSummaryResponse;
import com.hrmate.yearend.dto.YearEndInputRequest;
import com.hrmate.yearend.dto.YearEndInputResponse;
import com.hrmate.yearend.dto.YearEndResultResponse;
import com.hrmate.yearend.dto.YearEndResultResponse.Calculation;
import com.hrmate.yearend.dto.YearEndResultResponse.EmployeeInfo;
import com.hrmate.yearend.dto.YearEndResultResponse.Sources;
import com.hrmate.yearend.repository.YearEndInputRepository;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 연말정산 입력 자료 저장과 모의 계산 (포트폴리오용, 전문가 검증 전)
 *
 * <ul>
 *   <li>해당 귀속연도(pay_year)의 확정된 급여만 합산해 계산기에 넘긴다. 계산 결과는 저장하지 않는다.</li>
 *   <li>급여 데이터로만 알 수 있는 안내(식대 한도 초과 달, 작성 중 급여 제외, 퇴사자)를 붙인다.</li>
 *   <li>논리 삭제된 사원은 조회·계산만 가능하고 입력 자료를 저장할 수 없다.</li>
 * </ul>
 * 규칙: docs/requirements-year-end.md
 */
@Service
@Transactional(readOnly = true)
public class YearEndService {

    public static final String NOTICE = "모의 계산 · 전문가 검증 전 · 지방소득세 미포함";

    private final PayrollRepository payrollRepository;
    private final YearEndInputRepository inputRepository;
    private final EmployeeRepository employeeRepository;

    public YearEndService(PayrollRepository payrollRepository, YearEndInputRepository inputRepository,
                          EmployeeRepository employeeRepository) {
        this.payrollRepository = payrollRepository;
        this.inputRepository = inputRepository;
        this.employeeRepository = employeeRepository;
    }

    /** 그 해 확정 급여가 있는 사원 목록과 계산 요약 (사번 순) */
    public List<YearEndEmployeeSummaryResponse> getEmployees(Integer year) {
        int taxYear = validateYear(year);
        Map<Long, List<Payroll>> byEmployee = new LinkedHashMap<>();
        for (Payroll payroll : payrollRepository.findAllForAnnual(taxYear, PayrollPeriodStatus.CONFIRMED)) {
            byEmployee.computeIfAbsent(payroll.getEmployee().getId(), id -> new ArrayList<>()).add(payroll);
        }
        Map<Long, YearEndInput> inputs = inputRepository.findAllByTaxYear(taxYear).stream()
                .collect(Collectors.toMap(input -> input.getEmployee().getId(), Function.identity()));

        return byEmployee.values().stream()
                .map(payrolls -> {
                    Payroll latest = payrolls.get(payrolls.size() - 1);
                    Employee employee = latest.getEmployee();
                    YearEndInput input = inputs.get(employee.getId());
                    YearEndCalculationResult result = calculate(taxYear, YearEndPayrollTotals.of(payrolls), input);
                    return new YearEndEmployeeSummaryResponse(employee.getId(), latest.getEmployeeNo(),
                            latest.getEmployeeName(), latest.getDepartment(), latest.getPosition(), employee.isDeleted(),
                            isResigned(employee), input != null, payrolls.size(), result.totalSalary(),
                            result.determinedTax(), result.prepaidTax(), result.balance(), result.rulesYear());
                })
                .toList();
    }

    public YearEndInputResponse getInput(Long employeeId, Integer year) {
        int taxYear = validateYear(year);
        Employee employee = findEmployee(employeeId);
        return YearEndInputResponse.of(taxYear, employee,
                inputRepository.findByEmployee_IdAndTaxYear(employee.getId(), taxYear).orElse(null));
    }

    /** 입력 자료 저장 (없으면 생성, 있으면 전체 교체) */
    @Transactional
    public YearEndInputResponse saveInput(Long employeeId, Integer year, YearEndInputRequest request) {
        int taxYear = validateYear(year);
        Employee employee = findEmployee(employeeId);
        if (employee.isDeleted()) {
            throw new BusinessException(ErrorCode.YEAR_END_INPUT_LOCKED);
        }
        PersonalDeductionInput values;
        try {
            values = request.toPersonalDeductionInput();
        } catch (IllegalArgumentException e) {
            // 여러 항목에 걸친 규칙 위반 (배우자·한부모 동시 선택, 자녀 수 > 부양가족 등)
            throw BusinessException.invalidField("input", e.getMessage());
        }

        YearEndInput input = inputRepository.findByEmployee_IdAndTaxYear(employee.getId(), taxYear)
                .map(existing -> {
                    existing.change(values);
                    return existing;
                })
                .orElseGet(() -> YearEndInput.create(employee, taxYear, values));
        return YearEndInputResponse.of(taxYear, employee, inputRepository.saveAndFlush(input));
    }

    /** 모의 계산 결과. 확정 급여가 없으면 calculable=false */
    public YearEndResultResponse getResult(Long employeeId, Integer year) {
        int taxYear = validateYear(year);
        Employee employee = findEmployee(employeeId);
        List<Payroll> payrolls = payrollRepository.findAllForAnnualByEmployee(
                employee.getId(), taxYear, PayrollPeriodStatus.CONFIRMED);
        long drafts = payrollRepository.countByEmployee_IdAndPeriod_PayYearAndPeriod_Status(
                employee.getId(), taxYear, PayrollPeriodStatus.DRAFT);
        YearEndInput input = inputRepository.findByEmployee_IdAndTaxYear(employee.getId(), taxYear).orElse(null);
        EmployeeInfo info = employeeInfo(employee, payrolls);

        List<String> payrollWarnings = new ArrayList<>();
        if (drafts > 0) {
            payrollWarnings.add("작성 중인 급여 %d건은 계산에서 제외했습니다.".formatted(drafts));
        }
        if (info.resigned()) {
            payrollWarnings.add("퇴사한 사원입니다. 중도 퇴사자 정산 방식은 반영하지 않았습니다.");
        }

        if (payrolls.isEmpty()) {
            List<String> warnings = new ArrayList<>();
            warnings.add("확정된 급여가 없어 계산할 수 없습니다.");
            warnings.addAll(payrollWarnings);
            return new YearEndResultResponse(taxYear, NOTICE, info, false, input != null, 0, drafts, null, null,
                    warnings, YearEndCalculator.ASSUMPTIONS);
        }

        YearEndPayrollTotals totals = YearEndPayrollTotals.of(payrolls);
        YearEndCalculationResult result = calculate(taxYear, totals, input);
        List<String> warnings = new ArrayList<>(result.warnings());
        // 2017년생 연령 기준 주의(해석 미확정): 자녀세액공제 대상 자녀를 1명 이상 입력한 경우에만 안내한다.
        String childCaution = ChildCreditAgeGuide.forYear(taxYear).caution();
        if (childCaution != null && input != null && input.toPersonalDeductionInput().childCreditCount() > 0) {
            warnings.add(childCaution);
        }
        if (!totals.mealOverLimitMonths().isEmpty()) {
            String months = totals.mealOverLimitMonths().stream().map(month -> month + "월")
                    .collect(Collectors.joining(", "));
            warnings.add("식대가 월 20만원을 넘는 달이 있습니다(%s). 비과세 한도 초과분의 과세 전환은 반영하지 않았습니다."
                    .formatted(months));
        }
        warnings.addAll(payrollWarnings);
        return new YearEndResultResponse(taxYear, NOTICE, info, true, input != null, payrolls.size(), drafts,
                Sources.from(totals), Calculation.from(result), warnings, result.assumptions());
    }

    private static YearEndCalculationResult calculate(int taxYear, YearEndPayrollTotals totals, YearEndInput input) {
        return YearEndCalculator.calculate(new YearEndCalculationInput(taxYear, totals.totalSalary(),
                totals.insurancePremium(), totals.nationalPension(), totals.incomeTax(),
                input == null ? null : input.toPersonalDeductionInput()));
    }

    /** 사원 정보: 그 해 마지막 확정 급여의 스냅샷, 없으면 현재 사원 정보 */
    private static EmployeeInfo employeeInfo(Employee employee, List<Payroll> payrolls) {
        if (payrolls.isEmpty()) {
            return new EmployeeInfo(employee.getId(), employee.getEmployeeNo(), employee.getName(),
                    employee.getDepartment(), employee.getPosition(), employee.isDeleted(), isResigned(employee));
        }
        Payroll latest = payrolls.get(payrolls.size() - 1);
        return new EmployeeInfo(employee.getId(), latest.getEmployeeNo(), latest.getEmployeeName(),
                latest.getDepartment(), latest.getPosition(), employee.isDeleted(), isResigned(employee));
    }

    private static boolean isResigned(Employee employee) {
        return employee.getEmploymentStatus() == EmploymentStatus.RESIGNED;
    }

    /** 논리 삭제된 사원도 찾는다(조회·계산 허용). 없으면 404 */
    private Employee findEmployee(Long employeeId) {
        return employeeRepository.findById(employeeId)
                .orElseThrow(() -> new BusinessException(ErrorCode.EMPLOYEE_NOT_FOUND));
    }

    private static int validateYear(Integer year) {
        if (year == null || year < YearEndCalculationInput.MIN_YEAR || year > YearEndCalculationInput.MAX_YEAR) {
            throw BusinessException.invalidField("year", "연도는 2000~2100 사이로 입력해 주세요.");
        }
        return year;
    }
}
