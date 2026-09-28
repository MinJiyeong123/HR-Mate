package com.hrmate.yearend.domain;

import com.hrmate.payroll.domain.Payroll;
import com.hrmate.payroll.domain.PayrollLine;
import com.hrmate.payroll.domain.TaxType;
import java.util.ArrayList;
import java.util.List;

/**
 * 한 사원의 확정 급여에서 연말정산에 쓰는 연간 합계 (docs/requirements-year-end.md 3장)
 * 항목 구분은 급여 입력 당시 복사해 둔 값(분류·과세 구분)과 항목 코드로 한다.
 *
 * @param mealOverLimitMonths 식대가 월 한도를 넘은 귀속 월 (경고용)
 */
public record YearEndPayrollTotals(
        int payrollCount,
        long totalSalary,
        long nonTaxableEarnings,
        long healthInsurance,
        long longTermCare,
        long employmentInsurance,
        long nationalPension,
        long incomeTax,
        List<Integer> mealOverLimitMonths
) {

    /** 비과세 식대 월 한도 (소득세법 제12조 제3호 러목, 경고에만 사용) */
    public static final long MEAL_MONTHLY_LIMIT = 200_000L;

    static final String HEALTH_INSURANCE = "HEALTH_INSURANCE";
    static final String LONG_TERM_CARE = "LONG_TERM_CARE";
    static final String EMPLOYMENT_INSURANCE = "EMPLOYMENT_INSURANCE";
    static final String NATIONAL_PENSION = "NATIONAL_PENSION";
    static final String INCOME_TAX = "INCOME_TAX";
    static final String MEAL_ALLOWANCE = "MEAL_ALLOWANCE";

    public YearEndPayrollTotals {
        mealOverLimitMonths = List.copyOf(mealOverLimitMonths);
    }

    /** payrolls: 한 사원의 확정 급여 (항목·항목 코드를 함께 읽은 상태), 월 순 */
    public static YearEndPayrollTotals of(List<Payroll> payrolls) {
        long taxable = 0;
        long nonTaxable = 0;
        long health = 0;
        long longTermCare = 0;
        long employment = 0;
        long pension = 0;
        long incomeTax = 0;
        List<Integer> mealOver = new ArrayList<>();

        for (Payroll payroll : payrolls) {
            long meal = 0;
            for (PayrollLine line : payroll.getLines()) {
                String code = line.getPayItem().getCode();
                long amount = line.getAmount();
                if (line.isEarning()) {
                    if (line.getTaxType() == TaxType.TAXABLE) {
                        taxable += amount;
                    } else {
                        nonTaxable += amount;
                    }
                    if (MEAL_ALLOWANCE.equals(code)) {
                        meal += amount;
                    }
                    continue;
                }
                switch (code) {
                    case HEALTH_INSURANCE -> health += amount;
                    case LONG_TERM_CARE -> longTermCare += amount;
                    case EMPLOYMENT_INSURANCE -> employment += amount;
                    case NATIONAL_PENSION -> pension += amount;
                    case INCOME_TAX -> incomeTax += amount;
                    default -> {
                        // 지방소득세·기타공제는 연말정산 계산에 쓰지 않는다.
                    }
                }
            }
            if (meal > MEAL_MONTHLY_LIMIT) {
                mealOver.add(payroll.getPeriod().getPayMonth());
            }
        }
        return new YearEndPayrollTotals(payrolls.size(), taxable, nonTaxable, health, longTermCare, employment,
                pension, incomeTax, mealOver);
    }

    /** 보험료 특별소득공제 대상 (건강보험 + 장기요양보험 + 고용보험) */
    public long insurancePremium() {
        return healthInsurance + longTermCare + employmentInsurance;
    }
}
