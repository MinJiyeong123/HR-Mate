package com.hrmate.payroll.dto;

import com.hrmate.employee.domain.Employee;
import com.hrmate.payroll.domain.Payroll;
import java.util.List;

/**
 * 연간 집계의 사원 한 줄
 * 이름·부서·직급은 그 해 마지막 확정 급여에 복사해 둔 값(스냅샷)이다. deleted 는 현재 사원의 논리 삭제 여부다.
 */
public record AnnualEmployeeSummaryResponse(
        Long employeeId,
        String employeeNo,
        String employeeName,
        String department,
        String position,
        boolean deleted,
        int payrollCount,
        AnnualTotals totals
) {

    /** payrolls: 한 사원의 급여 목록, 월 순 (1건 이상) */
    public static AnnualEmployeeSummaryResponse of(List<Payroll> payrolls) {
        Payroll latest = payrolls.get(payrolls.size() - 1);
        Employee employee = latest.getEmployee();
        return new AnnualEmployeeSummaryResponse(employee.getId(), latest.getEmployeeNo(), latest.getEmployeeName(),
                latest.getDepartment(), latest.getPosition(), employee.isDeleted(), payrolls.size(),
                AnnualTotals.sum(payrolls.stream().map(AnnualTotals::from).toList()));
    }
}
