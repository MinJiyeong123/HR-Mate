package com.hrmate.payroll.dto;

import java.util.List;

/**
 * 연간 급여 집계 (GET /api/payroll-summaries/annual?year=) - 포트폴리오용 시뮬레이션
 * 귀속 연도(pay_year) 기준, 확정된 기간만 합산한다. 기준: docs/tax-rules/income-attribution.md
 */
public record AnnualPayrollSummaryResponse(
        int year,
        long confirmedPeriodCount,
        long excludedDraftPeriodCount,
        AnnualTotals totals,
        List<AnnualEmployeeSummaryResponse> employees
) {
}
