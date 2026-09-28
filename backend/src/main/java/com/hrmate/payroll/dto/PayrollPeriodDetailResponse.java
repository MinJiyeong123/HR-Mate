package com.hrmate.payroll.dto;

import com.hrmate.payroll.domain.PayrollPeriodStatus;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** 급여 기간 상세 (GET /api/payroll-periods/{id}) - 요약 + 사원별 급여 목록 */
public record PayrollPeriodDetailResponse(
        Long id,
        int year,
        int month,
        LocalDate paymentDate,
        PayrollPeriodStatus status,
        LocalDateTime confirmedAt,
        long payrollCount,
        long totalEarnings,
        long totalDeductions,
        long totalNetPay,
        List<PayrollSummaryResponse> payrolls
) {

    public static PayrollPeriodDetailResponse of(PayrollPeriodSummaryResponse summary, List<PayrollSummaryResponse> payrolls) {
        return new PayrollPeriodDetailResponse(
                summary.id(), summary.year(), summary.month(), summary.paymentDate(), summary.status(),
                summary.confirmedAt(), summary.payrollCount(), summary.totalEarnings(), summary.totalDeductions(),
                summary.totalNetPay(), payrolls);
    }
}
