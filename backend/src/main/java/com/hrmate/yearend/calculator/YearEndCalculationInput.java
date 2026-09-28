package com.hrmate.yearend.calculator;

/**
 * 연말정산 계산 입력 (금액은 원 단위, 확정 급여의 연간 합계)
 *
 * @param taxYear            귀속연도 (2000~2100)
 * @param totalSalary        총급여 (과세 지급 합계)
 * @param insurancePremium   보험료 특별소득공제 대상 (건강보험 + 장기요양보험 + 고용보험)
 * @param pensionPremium     연금보험료공제 대상 (국민연금)
 * @param prepaidTax         기납부세액 (소득세 합계)
 * @param personal           인적공제 입력. null 이면 입력 자료 없음(본인 기본공제만)
 */
public record YearEndCalculationInput(
        int taxYear,
        long totalSalary,
        long insurancePremium,
        long pensionPremium,
        long prepaidTax,
        PersonalDeductionInput personal
) {

    public static final int MIN_YEAR = 2000;
    public static final int MAX_YEAR = 2100;

    public YearEndCalculationInput {
        if (taxYear < MIN_YEAR || taxYear > MAX_YEAR) {
            throw new IllegalArgumentException("귀속연도는 " + MIN_YEAR + "~" + MAX_YEAR + " 사이여야 합니다.");
        }
        if (totalSalary < 0 || insurancePremium < 0 || pensionPremium < 0 || prepaidTax < 0) {
            throw new IllegalArgumentException("금액은 0원 이상이어야 합니다.");
        }
    }
}
