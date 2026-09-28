package com.hrmate.yearend.calculator;

import java.util.List;

/**
 * 2026년 귀속 연말정산 규칙 (포트폴리오용 모의 계산, 전문가 검증 전)
 *
 * <p>근거: docs/tax-rules/year-end-settlement-2026.md (2026-09-29 확인)
 * <ul>
 *   <li>이 프로젝트가 계산하는 항목(근로소득공제·인적공제·연금보험료·보험료 공제·기본세율·근로소득·자녀·출산입양·
 *       표준세액공제)은 소득세법 해당 조문이 2025년 귀속 이후 금액이 바뀌도록 개정되지 않아 <b>금액 계산을 2025년 규칙에 위임</b>한다.</li>
 *   <li>자녀세액공제 나이 기준(부칙 법률 제21548호)은 계산에 쓰지 않으므로 {@link ChildCreditAgeGuide}에서 안내만 한다.</li>
 *   <li>국세청 2026년 귀속 연말정산 안내는 확인하지 못했다.</li>
 * </ul>
 */
public final class TaxRules2026 implements TaxRules {

    static final String RULE_NOTE = "2026년 귀속 규칙은 소득세법과 부칙(법률 제21548호 등)으로 확인한 범위만 반영했습니다. "
            + "계산 금액은 2025년 귀속과 같습니다(해당 조문 금액 개정 없음). "
            + "국세청 2026년 귀속 안내는 확인하지 못했고 전문가 검증 전입니다.";

    private final TaxRules base = new TaxRules2025();

    @Override
    public int year() {
        return 2026;
    }

    @Override
    public long earnedIncomeDeduction(long totalSalary) {
        return base.earnedIncomeDeduction(totalSalary);
    }

    @Override
    public long basicTax(long taxBase) {
        return base.basicTax(taxBase);
    }

    @Override
    public long earnedIncomeTaxCreditAmount(long calculatedTax) {
        return base.earnedIncomeTaxCreditAmount(calculatedTax);
    }

    @Override
    public long earnedIncomeTaxCreditLimit(long totalSalary) {
        return base.earnedIncomeTaxCreditLimit(totalSalary);
    }

    @Override
    public long childTaxCredit(int childCount) {
        return base.childTaxCredit(childCount);
    }

    @Override
    public long birthAdoptionTaxCredit(int firstCount, int secondCount, int thirdPlusCount) {
        return base.birthAdoptionTaxCredit(firstCount, secondCount, thirdPlusCount);
    }

    @Override
    public long basicDeductionPerPerson() {
        return base.basicDeductionPerPerson();
    }

    @Override
    public long elderlyDeductionPerPerson() {
        return base.elderlyDeductionPerPerson();
    }

    @Override
    public long disabledDeductionPerPerson() {
        return base.disabledDeductionPerPerson();
    }

    @Override
    public long womanDeduction() {
        return base.womanDeduction();
    }

    @Override
    public long womanDeductionIncomeLimit() {
        return base.womanDeductionIncomeLimit();
    }

    @Override
    public long singleParentDeduction() {
        return base.singleParentDeduction();
    }

    @Override
    public long standardTaxCredit() {
        return base.standardTaxCredit();
    }

    @Override
    public List<String> ruleNotes() {
        return List.of(RULE_NOTE);
    }
}
