package com.hrmate.payroll.service;

import com.hrmate.employee.domain.Employee;
import com.hrmate.employee.repository.EmployeeRepository;
import com.hrmate.global.error.BusinessException;
import com.hrmate.global.error.ErrorCode;
import com.hrmate.payroll.domain.Payroll;
import com.hrmate.payroll.domain.PayrollPeriod;
import com.hrmate.payroll.domain.PayrollPeriodStatus;
import com.hrmate.payroll.dto.AnnualEmployeePayrollResponse;
import com.hrmate.payroll.dto.AnnualEmployeeSummaryResponse;
import com.hrmate.payroll.dto.AnnualPayrollSummaryResponse;
import com.hrmate.payroll.dto.AnnualTotals;
import com.hrmate.payroll.repository.PayrollPeriodRepository;
import com.hrmate.payroll.repository.PayrollRepository;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 연간 급여 집계 (포트폴리오용 시뮬레이션, 조회만 한다)
 *
 * <ul>
 *   <li>귀속 연도(pay_year) 기준. 근로를 제공한 달을 귀속 월로 간주한다. (전문가 검증 전)
 *       근거와 확인하지 못한 항목: docs/tax-rules/income-attribution.md</li>
 *   <li>확정된 기간의 급여만 합산하고, 제외된 작성 중 기간(또는 급여) 수를 함께 돌려준다.</li>
 *   <li>논리 삭제된 사원도 포함하고 deleted 로 표시한다.</li>
 * </ul>
 */
@Service
@Transactional(readOnly = true)
public class PayrollSummaryService {

    private final PayrollRepository payrollRepository;
    private final PayrollPeriodRepository periodRepository;
    private final EmployeeRepository employeeRepository;

    public PayrollSummaryService(PayrollRepository payrollRepository, PayrollPeriodRepository periodRepository,
                                 EmployeeRepository employeeRepository) {
        this.payrollRepository = payrollRepository;
        this.periodRepository = periodRepository;
        this.employeeRepository = employeeRepository;
    }

    public AnnualPayrollSummaryResponse getAnnualSummary(Integer year) {
        int payYear = validateYear(year);
        List<Payroll> payrolls = payrollRepository.findAllForAnnual(payYear, PayrollPeriodStatus.CONFIRMED);

        // 조회 결과가 사번·월 순이므로 사원별로 순서를 유지하며 묶는다.
        Map<Long, List<Payroll>> byEmployee = new LinkedHashMap<>();
        for (Payroll payroll : payrolls) {
            byEmployee.computeIfAbsent(payroll.getEmployee().getId(), id -> new ArrayList<>()).add(payroll);
        }
        List<AnnualEmployeeSummaryResponse> employees = byEmployee.values().stream()
                .map(AnnualEmployeeSummaryResponse::of)
                .toList();

        return new AnnualPayrollSummaryResponse(payYear,
                periodRepository.countByPayYearAndStatus(payYear, PayrollPeriodStatus.CONFIRMED),
                periodRepository.countByPayYearAndStatus(payYear, PayrollPeriodStatus.DRAFT),
                AnnualTotals.sum(employees.stream().map(AnnualEmployeeSummaryResponse::totals).toList()),
                employees);
    }

    /** 없는 사원은 404, 논리 삭제된 사원은 deleted=true 로 돌려준다. */
    public AnnualEmployeePayrollResponse getEmployeeAnnual(Long employeeId, Integer year) {
        int payYear = validateYear(year);
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new BusinessException(ErrorCode.EMPLOYEE_NOT_FOUND));

        List<Payroll> payrolls = payrollRepository.findAllForAnnualByEmployee(
                employee.getId(), payYear, PayrollPeriodStatus.CONFIRMED);
        long excludedDrafts = payrollRepository.countByEmployee_IdAndPeriod_PayYearAndPeriod_Status(
                employee.getId(), payYear, PayrollPeriodStatus.DRAFT);
        return AnnualEmployeePayrollResponse.of(payYear, employee, payrolls, excludedDrafts);
    }

    private static int validateYear(Integer year) {
        if (year == null || year < PayrollPeriod.MIN_YEAR || year > PayrollPeriod.MAX_YEAR) {
            throw BusinessException.invalidField("year", "연도는 2000~2100 사이로 입력해 주세요.");
        }
        return year;
    }
}
