package com.hrmate.yearend.calculator;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * 2026년 귀속 규칙 단위 테스트 (DB 접속 없음)
 * 계산 금액은 현재 2025년 규칙에 위임하므로, 모든 계산 메서드가 2025년과 같은 값인지 확인한다.
 * (현재 조사 범위에서는 해당 조문의 금액 개정을 확인하지 못했으며, 2026년 귀속 국세청 안내 확인과 전문가 검증이 필요하다.)
 */
class TaxRules2026Test {

    private final TaxRules rules2026 = new TaxRules2026();
    private final TaxRules rules2025 = new TaxRules2025();

    @ParameterizedTest(name = "총급여 {0}")
    @ValueSource(longs = {0, 1_000, 5_000_000, 5_000_001, 15_000_000, 33_000_000, 33_800_000, 43_000_000, 45_000_000,
            70_000_000, 70_100_000, 80_000_000, 100_000_000, 120_000_000, 120_200_000, 130_000_000, 362_500_000, 500_000_000})
    void 총급여_기준_계산은_2025와_같다(long totalSalary) {
        assertThat(rules2026.earnedIncomeDeduction(totalSalary)).isEqualTo(rules2025.earnedIncomeDeduction(totalSalary));
        assertThat(rules2026.earnedIncomeTaxCreditLimit(totalSalary)).isEqualTo(rules2025.earnedIncomeTaxCreditLimit(totalSalary));
    }

    @ParameterizedTest(name = "과세표준·산출세액 {0}")
    @ValueSource(longs = {0, 1_000_000, 1_300_000, 1_300_001, 2_300_000, 14_000_000, 20_000_000, 50_000_000, 88_000_000,
            150_000_000, 300_000_000, 500_000_000, 1_000_000_000, 1_100_000_000})
    void 세율과_근로소득세액공제_공제액은_2025와_같다(long amount) {
        assertThat(rules2026.basicTax(amount)).isEqualTo(rules2025.basicTax(amount));
        assertThat(rules2026.earnedIncomeTaxCreditAmount(amount)).isEqualTo(rules2025.earnedIncomeTaxCreditAmount(amount));
        assertThat(rules2026.earnedIncomeTaxCredit(amount, 36_000_000)).isEqualTo(rules2025.earnedIncomeTaxCredit(amount, 36_000_000));
    }

    @Test
    void 자녀_출산입양_인적공제_표준세액공제는_2025와_같다() {
        for (int children = 0; children <= 5; children++) {
            assertThat(rules2026.childTaxCredit(children)).isEqualTo(rules2025.childTaxCredit(children));
        }
        assertThat(rules2026.birthAdoptionTaxCredit(1, 1, 2)).isEqualTo(rules2025.birthAdoptionTaxCredit(1, 1, 2));
        assertThat(rules2026.basicDeductionPerPerson()).isEqualTo(rules2025.basicDeductionPerPerson());
        assertThat(rules2026.elderlyDeductionPerPerson()).isEqualTo(rules2025.elderlyDeductionPerPerson());
        assertThat(rules2026.disabledDeductionPerPerson()).isEqualTo(rules2025.disabledDeductionPerPerson());
        assertThat(rules2026.womanDeduction()).isEqualTo(rules2025.womanDeduction());
        assertThat(rules2026.womanDeductionIncomeLimit()).isEqualTo(rules2025.womanDeductionIncomeLimit());
        assertThat(rules2026.singleParentDeduction()).isEqualTo(rules2025.singleParentDeduction());
        assertThat(rules2026.standardTaxCredit()).isEqualTo(rules2025.standardTaxCredit());
    }

    @Test
    void 연도와_확인_상태_안내() {
        assertThat(rules2026.year()).isEqualTo(2026);
        assertThat(rules2026.ruleNotes()).singleElement().asString()
                .contains("법률 제21548호").contains("국세청 2026년 귀속 안내는 확인하지 못했고").contains("전문가 검증 전");
        assertThat(rules2025.ruleNotes()).isEmpty();
    }
}
