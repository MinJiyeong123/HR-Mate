package com.hrmate.payroll.dto;

import com.hrmate.payroll.domain.Payroll;

/** 기간 상세의 사원별 급여 한 줄. 사원 정보는 입력 당시 복사해 둔 값이다. */
public record PayrollSummaryResponse(
        Long id,
        Long employeeId,
        String employeeNo,
        String employeeName,
        String department,
        String position,
        long totalEarnings,
        long totalDeductions,
        long netPay
) {

    public static PayrollSummaryResponse from(Payroll payroll) {
        return new PayrollSummaryResponse(
                payroll.getId(), payroll.getEmployee().getId(), payroll.getEmployeeNo(), payroll.getEmployeeName(),
                payroll.getDepartment(), payroll.getPosition(),
                payroll.getTotalEarnings(), payroll.getTotalDeductions(), payroll.getNetPay());
    }
}
