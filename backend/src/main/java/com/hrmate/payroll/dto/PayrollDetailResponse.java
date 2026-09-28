package com.hrmate.payroll.dto;

import com.hrmate.payroll.domain.Payroll;
import com.hrmate.payroll.domain.PayrollLine;
import com.hrmate.payroll.domain.PayrollPeriod;
import com.hrmate.payroll.domain.PayrollPeriodStatus;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

/**
 * 급여명세서 (GET /api/payrolls/{id}) - 포트폴리오용 시뮬레이션
 * 지급·공제 항목은 항목 표시 순서로 정렬한다.
 */
public record PayrollDetailResponse(
        Long id,
        PeriodInfo period,
        Long employeeId,
        String employeeNo,
        String employeeName,
        String department,
        String position,
        List<PayrollLineResponse> earnings,
        List<PayrollLineResponse> deductions,
        long totalEarnings,
        long totalDeductions,
        long netPay,
        String memo
) {

    /** 명세서에 표시할 급여 기간 정보 */
    public record PeriodInfo(Long id, int year, int month, LocalDate paymentDate, PayrollPeriodStatus status) {

        static PeriodInfo from(PayrollPeriod period) {
            return new PeriodInfo(period.getId(), period.getPayYear(), period.getPayMonth(),
                    period.getPaymentDate(), period.getStatus());
        }
    }

    public static PayrollDetailResponse from(Payroll payroll) {
        List<PayrollLine> sorted = payroll.getLines().stream()
                .sorted(Comparator.comparingInt(line -> line.getPayItem().getSortOrder()))
                .toList();
        return new PayrollDetailResponse(
                payroll.getId(),
                PeriodInfo.from(payroll.getPeriod()),
                payroll.getEmployee().getId(),
                payroll.getEmployeeNo(),
                payroll.getEmployeeName(),
                payroll.getDepartment(),
                payroll.getPosition(),
                sorted.stream().filter(PayrollLine::isEarning).map(PayrollLineResponse::from).toList(),
                sorted.stream().filter(line -> !line.isEarning()).map(PayrollLineResponse::from).toList(),
                payroll.getTotalEarnings(),
                payroll.getTotalDeductions(),
                payroll.getNetPay(),
                payroll.getMemo());
    }
}
