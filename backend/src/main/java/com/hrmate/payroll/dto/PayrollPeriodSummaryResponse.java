package com.hrmate.payroll.dto;

import com.hrmate.payroll.domain.Payroll;
import com.hrmate.payroll.domain.PayrollPeriod;
import com.hrmate.payroll.domain.PayrollPeriodStatus;
import com.hrmate.payroll.repository.PayrollRepository.PeriodTotals;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** 급여 기간 요약 (목록 한 줄, 생성·확정·확정 취소 응답) */
public record PayrollPeriodSummaryResponse(
        Long id,
        int year,
        int month,
        LocalDate paymentDate,
        PayrollPeriodStatus status,
        LocalDateTime confirmedAt,
        long payrollCount,
        long totalEarnings,
        long totalDeductions,
        long totalNetPay
) {

    /** 기간에 속한 급여 목록으로 인원·합계를 계산한다. */
    public static PayrollPeriodSummaryResponse of(PayrollPeriod period, List<Payroll> payrolls) {
        return new PayrollPeriodSummaryResponse(
                period.getId(), period.getPayYear(), period.getPayMonth(), period.getPaymentDate(),
                period.getStatus(), period.getConfirmedAt(),
                payrolls.size(),
                payrolls.stream().mapToLong(Payroll::getTotalEarnings).sum(),
                payrolls.stream().mapToLong(Payroll::getTotalDeductions).sum(),
                payrolls.stream().mapToLong(Payroll::getNetPay).sum());
    }

    /** totals 가 null 이면 급여 0건으로 본다. */
    public static PayrollPeriodSummaryResponse of(PayrollPeriod period, PeriodTotals totals) {
        return new PayrollPeriodSummaryResponse(
                period.getId(), period.getPayYear(), period.getPayMonth(), period.getPaymentDate(),
                period.getStatus(), period.getConfirmedAt(),
                totals == null ? 0 : totals.getPayrollCount(),
                totals == null ? 0 : totals.getTotalEarnings(),
                totals == null ? 0 : totals.getTotalDeductions(),
                totals == null ? 0 : totals.getTotalNetPay());
    }
}
