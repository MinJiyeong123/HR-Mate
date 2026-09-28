package com.hrmate.yearend.calculator;

/**
 * 2025년 귀속 연말정산 규칙 (포트폴리오용 모의 계산, 전문가 검증 전)
 *
 * <p>근거(원문): docs/tax-rules/year-end-settlement-2025.md 2장
 * - 소득세법 제47조(근로소득공제), 제50조·제51조(인적공제), 제55조(세율), 제59조(근로소득세액공제),
 *   제59조의2(자녀세액공제, 금액은 국세청 안내와 동일), 제59조의4⑨(표준세액공제)
 * <p>비율은 "금액 × 분자 / 분모" 정수 연산으로 계산하고 원 미만은 버린다(가정).
 */
public final class TaxRules2025 implements TaxRules {

    private static final long MAN = 10_000L; // 만원

    @Override
    public int year() {
        return 2025;
    }

    @Override
    public long earnedIncomeDeduction(long totalSalary) {
        long deduction;
        if (totalSalary <= 500 * MAN) {
            deduction = totalSalary * 70 / 100;
        } else if (totalSalary <= 1_500 * MAN) {
            deduction = 350 * MAN + (totalSalary - 500 * MAN) * 40 / 100;
        } else if (totalSalary <= 4_500 * MAN) {
            deduction = 750 * MAN + (totalSalary - 1_500 * MAN) * 15 / 100;
        } else if (totalSalary <= 10_000 * MAN) {
            deduction = 1_200 * MAN + (totalSalary - 4_500 * MAN) * 5 / 100;
        } else {
            deduction = 1_475 * MAN + (totalSalary - 10_000 * MAN) * 2 / 100;
        }
        // 한도 2천만원, 총급여보다 클 수 없음 (제47조①③)
        return Math.min(Math.min(deduction, 2_000 * MAN), totalSalary);
    }

    @Override
    public long basicTax(long taxBase) {
        if (taxBase <= 1_400 * MAN) {
            return taxBase * 6 / 100;
        } else if (taxBase <= 5_000 * MAN) {
            return 84 * MAN + (taxBase - 1_400 * MAN) * 15 / 100;
        } else if (taxBase <= 8_800 * MAN) {
            return 624 * MAN + (taxBase - 5_000 * MAN) * 24 / 100;
        } else if (taxBase <= 15_000 * MAN) {
            return 1_536 * MAN + (taxBase - 8_800 * MAN) * 35 / 100;
        } else if (taxBase <= 30_000 * MAN) {
            return 3_706 * MAN + (taxBase - 15_000 * MAN) * 38 / 100;
        } else if (taxBase <= 50_000 * MAN) {
            return 9_406 * MAN + (taxBase - 30_000 * MAN) * 40 / 100;
        } else if (taxBase <= 100_000 * MAN) {
            return 17_406 * MAN + (taxBase - 50_000 * MAN) * 42 / 100;
        }
        return 38_406 * MAN + (taxBase - 100_000 * MAN) * 45 / 100;
    }

    @Override
    public long earnedIncomeTaxCreditAmount(long calculatedTax) {
        if (calculatedTax <= 130 * MAN) {
            return calculatedTax * 55 / 100;
        }
        return 715_000L + (calculatedTax - 130 * MAN) * 30 / 100;
    }

    @Override
    public long earnedIncomeTaxCreditLimit(long totalSalary) {
        if (totalSalary <= 3_300 * MAN) {
            return 74 * MAN;
        } else if (totalSalary <= 7_000 * MAN) {
            return Math.max(66 * MAN, 74 * MAN - (totalSalary - 3_300 * MAN) * 8 / 1000);
        } else if (totalSalary <= 12_000 * MAN) {
            return Math.max(50 * MAN, 66 * MAN - (totalSalary - 7_000 * MAN) / 2);
        }
        return Math.max(20 * MAN, 50 * MAN - (totalSalary - 12_000 * MAN) / 2);
    }

    @Override
    public long childTaxCredit(int childCount) {
        if (childCount <= 0) {
            return 0;
        } else if (childCount == 1) {
            return 25 * MAN;
        } else if (childCount == 2) {
            return 55 * MAN;
        }
        return 55 * MAN + (childCount - 2L) * 40 * MAN;
    }

    @Override
    public long birthAdoptionTaxCredit(int firstCount, int secondCount, int thirdPlusCount) {
        return firstCount * 30 * MAN + secondCount * 50 * MAN + thirdPlusCount * 70 * MAN;
    }

    @Override
    public long basicDeductionPerPerson() {
        return 150 * MAN;
    }

    @Override
    public long elderlyDeductionPerPerson() {
        return 100 * MAN;
    }

    @Override
    public long disabledDeductionPerPerson() {
        return 200 * MAN;
    }

    @Override
    public long womanDeduction() {
        return 50 * MAN;
    }

    @Override
    public long womanDeductionIncomeLimit() {
        return 3_000 * MAN;
    }

    @Override
    public long singleParentDeduction() {
        return 100 * MAN;
    }

    @Override
    public long standardTaxCredit() {
        return 13 * MAN;
    }
}
