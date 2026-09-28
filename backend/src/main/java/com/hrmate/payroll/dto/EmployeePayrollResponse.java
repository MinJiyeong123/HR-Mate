package com.hrmate.payroll.dto;

import com.hrmate.payroll.domain.Payroll;
import com.hrmate.payroll.domain.PayrollPeriod;
import com.hrmate.payroll.domain.PayrollPeriodStatus;
import java.time.LocalDate;

/** 사원별 연간 급여 내역 한 줄 (GET /api/employees/{id}/payrolls?year=) */
public record EmployeePayrollResponse(
        Long payrollId,
        Long periodId,
        int year,
        int month,
        LocalDate paymentDate,
        PayrollPeriodStatus status,
        long totalEarnings,
        long totalDeductions,
        long netPay
) {

    public static EmployeePayrollResponse from(Payroll payroll) {
        PayrollPeriod period = payroll.getPeriod();
        return new EmployeePayrollResponse(payroll.getId(), period.getId(), period.getPayYear(), period.getPayMonth(),
                period.getPaymentDate(), period.getStatus(),
                payroll.getTotalEarnings(), payroll.getTotalDeductions(), payroll.getNetPay());
    }
}
