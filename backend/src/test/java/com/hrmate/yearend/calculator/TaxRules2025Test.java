package com.hrmate.yearend.calculator;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * 2025년 귀속 규칙 단위 테스트 (DB 접속 없음)
 * 기대값은 docs/tax-rules/year-end-settlement-2025.md 의 표·공식으로 손으로 계산한 값이다(원 미만 버림).
 */
class TaxRules2025Test {

    private final TaxRules rules = new TaxRules2025();

    @Test
    void 국세청_사례_총급여_3380만원의_근로소득공제는_1032만원() {
        // 750만 + (3,380만 − 1,500만) × 15% = 1,032만
        assertThat(rules.earnedIncomeDeduction(33_800_000)).isEqualTo(10_320_000);
    }

    @Test
    void 국세청_사례_과세표준_2000만원의_산출세액은_174만원() {
        // 84만 + (2,000만 − 1,400만) × 15% = 1,740,000
        assertThat(rules.basicTax(20_000_000)).isEqualTo(1_740_000);
    }

    @ParameterizedTest(name = "총급여 {0} → 근로소득공제 {1}")
    @CsvSource({
            "0, 0",
            "1000, 700",                 // 70%
            "5000000, 3500000",          // 500만 × 70%
            "5000001, 3500000",          // 350만 + 1 × 40% (원 미만 버림)
            "15000000, 7500000",         // 350만 + 1,000만 × 40%
            "45000000, 12000000",        // 750만 + 3,000만 × 15%
            "100000000, 14750000",       // 1,200만 + 5,500만 × 5%
            "362500000, 20000000",       // 1,475만 + 2억6,250만 × 2% = 2,000만 (한도와 같음)
            "500000000, 20000000"        // 1,475만 + 4억 × 2% = 2,275만 → 한도 2,000만
    })
    void 근로소득공제_구간과_한도(long totalSalary, long expected) {
        assertThat(rules.earnedIncomeDeduction(totalSalary)).isEqualTo(expected);
    }

    @ParameterizedTest(name = "과세표준 {0} → 산출세액 {1}")
    @CsvSource({
            "0, 0",
            "14000000, 840000",          // 1,400만 × 6%
            "50000000, 6240000",         // 84만 + 3,600만 × 15%
            "88000000, 15360000",        // 624만 + 3,800만 × 24%
            "150000000, 37060000",       // 1,536만 + 6,200만 × 35%
            "300000000, 94060000",       // 3,706만 + 1억5천만 × 38%
            "500000000, 174060000",      // 9,406만 + 2억 × 40%
            "1000000000, 384060000",     // 1억7,406만 + 5억 × 42%
            "1100000000, 429060000"      // 3억8,406만 + 1억 × 45%
    })
    void 기본세율_구간_경계(long taxBase, long expected) {
        assertThat(rules.basicTax(taxBase)).isEqualTo(expected);
    }

    @ParameterizedTest(name = "산출세액 {0} → 근로소득세액공제 공제액 {1}")
    @CsvSource({
            "1000000, 550000",           // 55%
            "1300000, 715000",           // 130만 × 55%
            "1300001, 715000",           // 71만5천 + 1 × 30% (원 미만 버림)
            "2300000, 1015000"           // 71만5천 + 100만 × 30%
    })
    void 근로소득세액공제_공제액(long calculatedTax, long expected) {
        assertThat(rules.earnedIncomeTaxCreditAmount(calculatedTax)).isEqualTo(expected);
    }

    @ParameterizedTest(name = "총급여 {0} → 근로소득세액공제 한도 {1}")
    @CsvSource({
            "33000000, 740000",          // 3,300만 이하 74만
            "38000000, 700000",          // 74만 − 500만 × 8/1000
            "43000000, 660000",          // 74만 − 1,000만 × 8/1000 = 66만
            "70000000, 660000",          // 74만 − 3,700만 × 8/1000 = 44만4천 → 최소 66만
            "70100000, 610000",          // 66만 − 10만 × 1/2
            "80000000, 500000",          // 66만 − 1,000만 × 1/2 → 최소 50만
            "120000000, 500000",         // 최소 50만
            "120200000, 400000",         // 50만 − 20만 × 1/2
            "130000000, 200000"          // 50만 − 1,000만 × 1/2 → 최소 20만
    })
    void 근로소득세액공제_한도(long totalSalary, long expected) {
        assertThat(rules.earnedIncomeTaxCreditLimit(totalSalary)).isEqualTo(expected);
    }

    @Test
    void 근로소득세액공제는_공제액과_한도_중_작은_금액() {
        // 공제액 1,015,000, 한도(총급여 3,300만) 740,000
        assertThat(rules.earnedIncomeTaxCredit(2_300_000, 33_000_000)).isEqualTo(740_000);
        // 공제액 550,000, 한도 740,000
        assertThat(rules.earnedIncomeTaxCredit(1_000_000, 33_000_000)).isEqualTo(550_000);
    }

    @ParameterizedTest(name = "자녀 {0}명 → {1}")
    @CsvSource({
            "0, 0",
            "1, 250000",
            "2, 550000",
            "3, 950000",                 // 국세청 안내: 3명 95만원
            "4, 1350000",                // 국세청 안내: 4명 135만원
            "5, 1750000"                 // 국세청 안내: 5명 175만원
    })
    void 자녀세액공제_자녀_수(int childCount, long expected) {
        assertThat(rules.childTaxCredit(childCount)).isEqualTo(expected);
    }

    @Test
    void 출산_입양_세액공제() {
        assertThat(rules.birthAdoptionTaxCredit(1, 0, 0)).isEqualTo(300_000);
        assertThat(rules.birthAdoptionTaxCredit(0, 1, 0)).isEqualTo(500_000);
        assertThat(rules.birthAdoptionTaxCredit(0, 0, 2)).isEqualTo(1_400_000);
        assertThat(rules.birthAdoptionTaxCredit(1, 1, 1)).isEqualTo(1_500_000);
    }

    @Test
    void 인적공제와_표준세액공제_금액() {
        assertThat(rules.year()).isEqualTo(2025);
        assertThat(rules.basicDeductionPerPerson()).isEqualTo(1_500_000);
        assertThat(rules.elderlyDeductionPerPerson()).isEqualTo(1_000_000);
        assertThat(rules.disabledDeductionPerPerson()).isEqualTo(2_000_000);
        assertThat(rules.womanDeduction()).isEqualTo(500_000);
        assertThat(rules.womanDeductionIncomeLimit()).isEqualTo(30_000_000);
        assertThat(rules.singleParentDeduction()).isEqualTo(1_000_000);
        assertThat(rules.standardTaxCredit()).isEqualTo(130_000);
    }
}
