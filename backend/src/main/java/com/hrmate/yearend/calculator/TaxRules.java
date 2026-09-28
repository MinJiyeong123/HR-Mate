package com.hrmate.yearend.calculator;

/**
 * 귀속연도별 연말정산 계산 규칙 (포트폴리오용 모의 계산, 전문가 검증 전)
 *
 * <p>금액은 원 단위 정수이며, 비율 계산의 원 미만은 버린다(가정).
 * 규칙 근거: docs/tax-rules/year-end-settlement-2025.md, 계산 순서: docs/requirements-year-end.md
 */
public interface TaxRules {

    /** 이 규칙의 귀속연도 */
    int year();

    /** 근로소득공제 (총급여 구간별, 한도 포함) */
    long earnedIncomeDeduction(long totalSalary);

    /** 기본세율로 계산한 산출세액 */
    long basicTax(long taxBase);

    /** 근로소득세액공제 공제액 (한도 적용 전) */
    long earnedIncomeTaxCreditAmount(long calculatedTax);

    /** 근로소득세액공제 한도 (총급여 기준) */
    long earnedIncomeTaxCreditLimit(long totalSalary);

    /** 자녀세액공제 중 자녀 수에 따른 금액 */
    long childTaxCredit(int childCount);

    /** 자녀세액공제 중 출산·입양 금액 */
    long birthAdoptionTaxCredit(int firstCount, int secondCount, int thirdPlusCount);

    /** 기본공제 1명당 금액 */
    long basicDeductionPerPerson();

    /** 추가공제: 경로우대(70세 이상) 1명당 금액 */
    long elderlyDeductionPerPerson();

    /** 추가공제: 장애인 1명당 금액 */
    long disabledDeductionPerPerson();

    /** 추가공제: 부녀자 금액 */
    long womanDeduction();

    /** 부녀자 공제를 받을 수 있는 종합소득금액 상한 */
    long womanDeductionIncomeLimit();

    /** 추가공제: 한부모 금액 */
    long singleParentDeduction();

    /** 표준세액공제 (근로소득자) */
    long standardTaxCredit();

    /** 근로소득세액공제 = min(공제액, 한도) */
    default long earnedIncomeTaxCredit(long calculatedTax, long totalSalary) {
        return Math.min(earnedIncomeTaxCreditAmount(calculatedTax), earnedIncomeTaxCreditLimit(totalSalary));
    }
}
