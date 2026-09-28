package com.hrmate.yearend.calculator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hrmate.yearend.calculator.YearEndCalculationResult.AppliedAmount;
import org.junit.jupiter.api.Test;

/**
 * 연말정산 모의 계산 전체 흐름 테스트 (DB 접속 없음). 금액은 모두 가상 값이다.
 * 기대값은 docs/requirements-year-end.md 5장 공식으로 손으로 계산했다(원 미만 버림).
 */
class YearEndCalculatorTest {

    private static PersonalDeductionInput personal(boolean spouse, int dependents, boolean woman,
                                                   boolean singleParent, int children, int birthFirst) {
        return new PersonalDeductionInput(spouse, dependents, 0, 0, woman, singleParent, children, birthFirst, 0, 0);
    }

    private static YearEndCalculationResult calculate(int year, long salary, long insurance, long pension,
                                                      long prepaid, PersonalDeductionInput personal) {
        return YearEndCalculator.calculate(new YearEndCalculationInput(year, salary, insurance, pension, prepaid, personal));
    }

    @Test
    void 일반적인_계산_흐름과_환급() {
        // 총급여 3,600만, 배우자 + 자녀 1명(자녀세액공제 대상), 보험료 150만, 국민연금 162만, 기납부 100만
        YearEndCalculationResult result = calculate(2025, 36_000_000, 1_500_000, 1_620_000, 1_000_000,
                personal(true, 1, false, false, 1, 0));

        assertThat(result.rulesYear()).isEqualTo(2025);
        assertThat(result.earnedIncomeDeduction()).isEqualTo(10_650_000);   // 750만 + 2,100만 × 15%
        assertThat(result.earnedIncomeAmount()).isEqualTo(25_350_000);
        assertThat(result.basicDeduction()).isEqualTo(4_500_000);           // 3명 × 150만
        assertThat(result.personalDeduction()).isEqualTo(new AppliedAmount(4_500_000, 4_500_000));
        assertThat(result.insuranceDeduction()).isEqualTo(new AppliedAmount(1_500_000, 1_500_000));
        assertThat(result.pensionDeduction()).isEqualTo(new AppliedAmount(1_620_000, 1_620_000));
        assertThat(result.taxBase()).isEqualTo(17_730_000);                 // 2,535만 − 450만 − 150만 − 162만
        assertThat(result.calculatedTax()).isEqualTo(1_399_500);            // 84만 + 373만 × 15%
        // 공제액 71만5천 + 99,500 × 30% = 744,850, 한도 74만 − 300만 × 8/1000 = 716,000
        assertThat(result.earnedIncomeTaxCredit()).isEqualTo(716_000);
        assertThat(result.childTaxCredit()).isEqualTo(250_000);
        assertThat(result.standardTaxCredit()).isZero();                    // 보험료 공제가 있으므로 미적용
        assertThat(result.taxCredit()).isEqualTo(new AppliedAmount(966_000, 966_000));
        assertThat(result.determinedTax()).isEqualTo(433_500);              // 1,399,500 − 966,000
        assertThat(result.balance()).isEqualTo(-566_500);                   // 433,500 − 1,000,000
        assertThat(result.refund()).isEqualTo(566_500);
        assertThat(result.additionalPayment()).isZero();
        assertThat(result.warnings()).isEmpty();
        assertThat(result.assumptions()).hasSize(3);
    }

    @Test
    void 기납부세액이_적으면_추가_납부() {
        YearEndCalculationResult result = calculate(2025, 36_000_000, 1_500_000, 1_620_000, 0,
                personal(true, 1, false, false, 1, 0));

        assertThat(result.balance()).isEqualTo(433_500);
        assertThat(result.additionalPayment()).isEqualTo(433_500);
        assertThat(result.refund()).isZero();
    }

    @Test
    void 보험료_공제가_없으면_표준세액공제를_적용하고_차이가_없을_수_있다() {
        // 과세표준 2,535만 − 150만 = 2,385만, 산출세액 84만 + 985만 × 15% = 2,317,500
        // 근로소득세액공제 min(1,020,250, 716,000) = 716,000, 표준 130,000 → 결정세액 1,471,500
        YearEndCalculationResult result = calculate(2025, 36_000_000, 0, 0, 1_471_500, PersonalDeductionInput.SELF_ONLY);

        assertThat(result.taxBase()).isEqualTo(23_850_000);
        assertThat(result.calculatedTax()).isEqualTo(2_317_500);
        assertThat(result.standardTaxCredit()).isEqualTo(130_000);
        assertThat(result.determinedTax()).isEqualTo(1_471_500);
        assertThat(result.balance()).isZero();
        assertThat(result.warnings()).isEmpty();
    }

    @Test
    void 입력_자료가_없고_규칙이_없는_연도이며_공제가_소득을_넘는_경우() {
        // 2027년 귀속(규칙 미등록) → 2025년 규칙으로 대체. 총급여 320만 → 근로소득공제 224만, 근로소득금액 96만
        // (4-6에서 2026년 규칙이 등록되어 이 테스트의 대체 연도를 2026 → 2027로 바꿈. 금액·경고 구성은 동일)
        YearEndCalculationResult result = calculate(2027, 3_200_000, 0, 0, 100_000, null);

        assertThat(result.taxYear()).isEqualTo(2027);
        assertThat(result.rulesYear()).isEqualTo(2025);
        assertThat(result.earnedIncomeAmount()).isEqualTo(960_000);
        assertThat(result.personalDeduction()).isEqualTo(new AppliedAmount(1_500_000, 960_000));
        assertThat(result.taxBase()).isZero();
        assertThat(result.calculatedTax()).isZero();
        assertThat(result.taxCredit()).isEqualTo(new AppliedAmount(130_000, 0)); // 표준세액공제만, 산출세액 0
        assertThat(result.determinedTax()).isZero();
        assertThat(result.refund()).isEqualTo(100_000);
        assertThat(result.warnings()).containsExactly(
                "2027년 귀속 급여에 2025년 귀속 규칙을 적용한 결과입니다. 2027년 개정 사항은 반영되지 않았습니다.",
                "연말정산 입력 자료가 없어 본인 기본공제만 적용했습니다.",
                "인적공제 중 540,000원은 한도 초과로 적용되지 않았습니다.",
                "세액공제 중 130,000원은 산출세액을 넘어 적용되지 않았습니다.");
    }

    @Test
    void 연도_2026은_등록된_2026년_규칙으로_계산하고_금액은_2025와_같다() {
        // 같은 입력을 2025·2026으로 계산: 금액은 모두 같고, 2026은 대체 경고 대신 규칙 확인 상태 안내가 붙는다.
        PersonalDeductionInput input = personal(true, 1, false, false, 1, 0);
        YearEndCalculationResult y2025 = calculate(2025, 36_000_000, 1_500_000, 1_620_000, 1_000_000, input);
        YearEndCalculationResult y2026 = calculate(2026, 36_000_000, 1_500_000, 1_620_000, 1_000_000, input);

        assertThat(y2026.rulesYear()).isEqualTo(2026);
        assertThat(y2026.taxBase()).isEqualTo(y2025.taxBase());
        assertThat(y2026.calculatedTax()).isEqualTo(y2025.calculatedTax());
        assertThat(y2026.taxCredit()).isEqualTo(y2025.taxCredit());
        assertThat(y2026.determinedTax()).isEqualTo(433_500);
        assertThat(y2026.balance()).isEqualTo(y2025.balance()).isEqualTo(-566_500);
        assertThat(y2025.warnings()).isEmpty();
        assertThat(y2026.warnings()).containsExactly(TaxRules2026.RULE_NOTE);
    }

    @Test
    void 연도_2024는_2025년_규칙으로_대체하고_경고한다() {
        YearEndCalculationResult result = calculate(2024, 36_000_000, 0, 0, 1_471_500, PersonalDeductionInput.SELF_ONLY);

        assertThat(result.rulesYear()).isEqualTo(2025);
        assertThat(result.balance()).isZero(); // 2025년 귀속 계산과 같음(보험료 없음 → 표준세액공제)
        assertThat(result.warnings()).containsExactly(
                "2024년 귀속 급여에 2025년 귀속 규칙을 적용한 결과입니다. 2024년 개정 사항은 반영되지 않았습니다.");
    }

    @Test
    void 연금보험료공제는_남은_소득_안에서만_적용된다() {
        // 총급여 1,000만 → 근로소득공제 550만, 근로소득금액 450만 − 인적 150만 − 보험료 200만 = 100만
        YearEndCalculationResult result = calculate(2025, 10_000_000, 2_000_000, 1_500_000, 0,
                PersonalDeductionInput.SELF_ONLY);

        assertThat(result.earnedIncomeDeduction()).isEqualTo(5_500_000);
        assertThat(result.insuranceDeduction()).isEqualTo(new AppliedAmount(2_000_000, 2_000_000));
        assertThat(result.pensionDeduction()).isEqualTo(new AppliedAmount(1_500_000, 1_000_000));
        assertThat(result.taxBase()).isZero();
        assertThat(result.warnings()).containsExactly("연금보험료공제 중 500,000원은 한도 초과로 적용되지 않았습니다.");
    }

    @Test
    void 부녀자_공제는_근로소득금액_3천만원_이하일_때만() {
        // 총급여 3,600만 → 근로소득금액 2,535만 (적용)
        YearEndCalculationResult applied = calculate(2025, 36_000_000, 0, 0, 0, personal(false, 1, true, false, 0, 0));
        assertThat(applied.additionalDeduction().woman()).isEqualTo(500_000);

        // 총급여 5,000만 → 근로소득공제 1,200만 + 500만 × 5% = 1,225만, 근로소득금액 3,775만 (미적용)
        YearEndCalculationResult notApplied = calculate(2025, 50_000_000, 0, 0, 0, personal(false, 1, true, false, 0, 0));
        assertThat(notApplied.earnedIncomeAmount()).isEqualTo(37_750_000);
        assertThat(notApplied.additionalDeduction().woman()).isZero();
        assertThat(notApplied.warnings()).containsExactly("근로소득금액이 30,000,000원을 넘어 부녀자 공제를 적용하지 않았습니다.");
    }

    @Test
    void 부녀자와_한부모를_모두_선택하면_한부모만_적용() {
        YearEndCalculationResult result = calculate(2025, 36_000_000, 0, 0, 0, personal(false, 1, true, true, 0, 0));

        assertThat(result.additionalDeduction().singleParent()).isEqualTo(1_000_000);
        assertThat(result.additionalDeduction().woman()).isZero();
        assertThat(result.personalDeduction().requested()).isEqualTo(4_000_000); // 기본 2명 300만 + 한부모 100만
        assertThat(result.warnings()).containsExactly("부녀자 공제와 한부모 공제를 모두 선택해 한부모 공제만 적용했습니다.");
    }

    @Test
    void 경로우대와_장애인_추가공제() {
        PersonalDeductionInput input = new PersonalDeductionInput(true, 1, 1, 1, false, false, 0, 0, 0, 0);
        YearEndCalculationResult result = calculate(2025, 60_000_000, 0, 0, 0, input);

        assertThat(result.additionalDeduction().elderly()).isEqualTo(1_000_000);
        assertThat(result.additionalDeduction().disabled()).isEqualTo(2_000_000);
        assertThat(result.personalDeduction().requested()).isEqualTo(7_500_000); // 기본 3명 450만 + 100만 + 200만
    }

    @Test
    void 자녀_수와_출산_입양_세액공제() {
        YearEndCalculationResult result = calculate(2025, 60_000_000, 0, 0, 0, personal(true, 3, false, false, 3, 1));

        assertThat(result.childTaxCredit()).isEqualTo(950_000);         // 3명: 55만 + 40만
        assertThat(result.birthAdoptionTaxCredit()).isEqualTo(300_000); // 첫째
    }

    @Test
    void 금액이나_연도가_범위를_벗어나면_거부한다() {
        assertThatThrownBy(() -> new YearEndCalculationInput(2025, -1, 0, 0, 0, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new YearEndCalculationInput(1999, 0, 0, 0, 0, null))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
