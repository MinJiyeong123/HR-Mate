package com.hrmate.yearend.calculator;

import com.hrmate.yearend.calculator.YearEndCalculationResult.AdditionalDeduction;
import com.hrmate.yearend.calculator.YearEndCalculationResult.AppliedAmount;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 연말정산 모의 계산 (포트폴리오용, 전문가 검증 전) - Spring·DB 에 의존하지 않는 순수 계산
 *
 * <p>계산 순서(docs/requirements-year-end.md 5장):
 * 총급여 → 근로소득공제 → 인적공제 → 보험료 특별소득공제 → 연금보험료공제 → 과세표준 → 산출세액
 * → 근로소득·자녀·표준세액공제 → 결정세액 → 기납부세액과 비교.
 * <p>급여 데이터에서 알 수 있는 안내(식대 한도 초과 달, 작성 중 급여 제외, 퇴사자 등)는 호출하는 서비스가 붙인다.
 */
public final class YearEndCalculator {

    /** 규칙이 등록되지 않은 연도에 대신 적용하는 규칙 (등록되지 않은 연도는 항상 2025년 규칙으로 대체) */
    static final TaxRules FALLBACK_RULES = new TaxRules2025();

    private static final TaxRules RULES_2026 = new TaxRules2026();

    /** 등록된 귀속연도별 규칙 (2025, 2026) */
    private static final Map<Integer, TaxRules> RULES = Map.of(
            FALLBACK_RULES.year(), FALLBACK_RULES,
            RULES_2026.year(), RULES_2026);

    /** 공식 자료로 확인하지 못해 가정한 계산 방식 (요구사항 5-9) */
    public static final List<String> ASSUMPTIONS = List.of(
            "각 단계 비율 계산의 원 미만은 버렸습니다.",
            "세액공제 합계가 산출세액을 넘으면 결정세액은 0원으로 했습니다.",
            "소득공제 한도를 넘을 때 인적공제 → 보험료 공제 → 연금보험료공제 순으로 적용액을 표시했습니다(과세표준에는 영향 없음).");

    private YearEndCalculator() {
    }

    public static YearEndCalculationResult calculate(YearEndCalculationInput input) {
        List<String> warnings = new ArrayList<>();
        TaxRules rules = RULES.get(input.taxYear());
        if (rules == null) {
            rules = FALLBACK_RULES;
            warnings.add("%d년 귀속 급여에 %d년 귀속 규칙을 적용한 결과입니다. %d년 개정 사항은 반영되지 않았습니다."
                    .formatted(input.taxYear(), rules.year(), input.taxYear()));
        }
        warnings.addAll(rules.ruleNotes()); // 예: 2026년 규칙의 확인 상태(국세청 안내 미확인 등)
        PersonalDeductionInput personal = input.personal();
        if (personal == null) {
            personal = PersonalDeductionInput.SELF_ONLY;
            warnings.add("연말정산 입력 자료가 없어 본인 기본공제만 적용했습니다.");
        }

        // 1~2. 총급여 → 근로소득공제 → 근로소득금액
        long totalSalary = input.totalSalary();
        long earnedIncomeDeduction = rules.earnedIncomeDeduction(totalSalary);
        long earnedIncomeAmount = totalSalary - earnedIncomeDeduction;

        // 3. 인적공제 (기본 + 추가), 근로소득금액 초과분은 없는 것으로 함
        long basicDeduction = personal.basicDeductionCount() * rules.basicDeductionPerPerson();
        AdditionalDeduction additional = additionalDeduction(rules, personal, earnedIncomeAmount, warnings);
        long remaining = earnedIncomeAmount;
        AppliedAmount personalDeduction = apply("인적공제", basicDeduction + additional.total(), remaining, warnings);
        remaining -= personalDeduction.applied();

        // 4. 보험료 특별소득공제 → 연금보험료공제 → 과세표준
        AppliedAmount insuranceDeduction = apply("보험료 공제", input.insurancePremium(), remaining, warnings);
        remaining -= insuranceDeduction.applied();
        AppliedAmount pensionDeduction = apply("연금보험료공제", input.pensionPremium(), remaining, warnings);
        remaining -= pensionDeduction.applied();
        long taxBase = remaining;

        // 5. 산출세액
        long calculatedTax = rules.basicTax(taxBase);

        // 6. 세액공제: 표준세액공제는 보험료 특별소득공제 대상 금액이 없을 때만 (결정 3)
        long earnedIncomeTaxCredit = rules.earnedIncomeTaxCredit(calculatedTax, totalSalary);
        long childTaxCredit = rules.childTaxCredit(personal.childCreditCount());
        long birthAdoptionTaxCredit = rules.birthAdoptionTaxCredit(
                personal.birthFirstCount(), personal.birthSecondCount(), personal.birthThirdPlusCount());
        long standardTaxCredit = input.insurancePremium() == 0 ? rules.standardTaxCredit() : 0;
        long creditTotal = earnedIncomeTaxCredit + childTaxCredit + birthAdoptionTaxCredit + standardTaxCredit;
        AppliedAmount taxCredit = new AppliedAmount(creditTotal, Math.min(creditTotal, calculatedTax));
        if (taxCredit.notApplied() > 0) {
            warnings.add("세액공제 중 %s은 산출세액을 넘어 적용되지 않았습니다.".formatted(won(taxCredit.notApplied())));
        }

        // 7. 결정세액 → 추가 납부 / 환급
        long determinedTax = calculatedTax - taxCredit.applied();
        long balance = determinedTax - input.prepaidTax();

        return new YearEndCalculationResult(input.taxYear(), rules.year(), totalSalary, earnedIncomeDeduction,
                earnedIncomeAmount, basicDeduction, additional, personalDeduction, insuranceDeduction, pensionDeduction,
                taxBase, calculatedTax, earnedIncomeTaxCredit, childTaxCredit, birthAdoptionTaxCredit, standardTaxCredit,
                taxCredit, determinedTax, input.prepaidTax(), balance, warnings, ASSUMPTIONS);
    }

    /** 추가공제: 한부모·부녀자를 모두 선택하면 한부모만, 부녀자는 종합소득금액 상한 이하일 때만 */
    private static AdditionalDeduction additionalDeduction(TaxRules rules, PersonalDeductionInput personal,
                                                           long earnedIncomeAmount, List<String> warnings) {
        long elderly = personal.elderlyCount() * rules.elderlyDeductionPerPerson();
        long disabled = personal.disabledCount() * rules.disabledDeductionPerPerson();
        long singleParent = personal.singleParentDeduction() ? rules.singleParentDeduction() : 0;
        long woman = 0;
        if (personal.womanDeduction()) {
            if (personal.singleParentDeduction()) {
                warnings.add("부녀자 공제와 한부모 공제를 모두 선택해 한부모 공제만 적용했습니다.");
            } else if (earnedIncomeAmount > rules.womanDeductionIncomeLimit()) {
                warnings.add("근로소득금액이 %s을 넘어 부녀자 공제를 적용하지 않았습니다."
                        .formatted(won(rules.womanDeductionIncomeLimit())));
            } else {
                woman = rules.womanDeduction();
            }
        }
        return new AdditionalDeduction(elderly, disabled, woman, singleParent);
    }

    /** 남은 소득 안에서만 공제를 적용하고, 넘는 금액은 안내한다. */
    private static AppliedAmount apply(String name, long requested, long remaining, List<String> warnings) {
        AppliedAmount amount = new AppliedAmount(requested, Math.min(requested, remaining));
        if (amount.notApplied() > 0) {
            warnings.add("%s 중 %s은 한도 초과로 적용되지 않았습니다.".formatted(name, won(amount.notApplied())));
        }
        return amount;
    }

    private static String won(long amount) {
        return String.format(Locale.KOREA, "%,d원", amount);
    }
}
