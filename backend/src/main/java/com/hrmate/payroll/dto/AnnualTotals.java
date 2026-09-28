package com.hrmate.payroll.dto;

import com.hrmate.payroll.domain.Payroll;
import com.hrmate.payroll.domain.PayrollLine;
import com.hrmate.payroll.domain.TaxType;
import java.util.Collection;

/**
 * 연간 집계 합계 (포트폴리오용 시뮬레이션)
 * 과세·비과세는 급여 입력 당시 복사해 둔 항목의 과세 구분으로 나눈다. 비과세 한도는 검사하지 않는다.
 */
public record AnnualTotals(
        long totalEarnings,
        long taxableEarnings,
        long nonTaxableEarnings,
        long totalDeductions,
        long netPay
) {

    public static final AnnualTotals ZERO = new AnnualTotals(0, 0, 0, 0, 0);

    /** 급여 1건의 합계. 지급 합계·공제 합계·실지급액은 저장된 값을 그대로 쓴다. */
    public static AnnualTotals from(Payroll payroll) {
        long nonTaxable = payroll.getLines().stream()
                .filter(line -> line.isEarning() && line.getTaxType() == TaxType.NON_TAXABLE)
                .mapToLong(PayrollLine::getAmount)
                .sum();
        long taxable = payroll.getLines().stream()
                .filter(line -> line.isEarning() && line.getTaxType() == TaxType.TAXABLE)
                .mapToLong(PayrollLine::getAmount)
                .sum();
        return new AnnualTotals(payroll.getTotalEarnings(), taxable, nonTaxable,
                payroll.getTotalDeductions(), payroll.getNetPay());
    }

    public static AnnualTotals sum(Collection<AnnualTotals> totals) {
        return totals.stream().reduce(ZERO, AnnualTotals::plus);
    }

    public AnnualTotals plus(AnnualTotals other) {
        return new AnnualTotals(totalEarnings + other.totalEarnings, taxableEarnings + other.taxableEarnings,
                nonTaxableEarnings + other.nonTaxableEarnings, totalDeductions + other.totalDeductions,
                netPay + other.netPay);
    }
}
