package com.hrmate.yearend.calculator;

import java.util.List;

/**
 * 연말정산 모의 계산 결과 (단계별 금액, 원 단위) - 공식 연말정산 결과가 아니다.
 *
 * @param taxYear               계산 대상 귀속연도
 * @param rulesYear             실제로 적용한 규칙의 귀속연도 (taxYear 와 다르면 warnings 에 안내)
 * @param basicDeduction        기본공제 (1명당 금액 × 기본공제 대상자 수)
 * @param personalDeduction     인적공제 (기본 + 추가) 신청액·적용액
 * @param insuranceDeduction    보험료 특별소득공제 신청액·적용액
 * @param pensionDeduction      연금보험료공제 신청액·적용액
 * @param taxCredit             세액공제 합계·산출세액 안에서 적용된 금액
 * @param balance               결정세액 − 기납부세액 (양수: 추가 납부, 음수: 환급)
 * @param warnings              계산 중 생긴 안내 (규칙 연도, 입력 자료 없음, 공제 미적용 등)
 * @param assumptions           공식 자료로 확인하지 못해 가정한 계산 방식
 */
public record YearEndCalculationResult(
        int taxYear,
        int rulesYear,
        long totalSalary,
        long earnedIncomeDeduction,
        long earnedIncomeAmount,
        long basicDeduction,
        AdditionalDeduction additionalDeduction,
        AppliedAmount personalDeduction,
        AppliedAmount insuranceDeduction,
        AppliedAmount pensionDeduction,
        long taxBase,
        long calculatedTax,
        long earnedIncomeTaxCredit,
        long childTaxCredit,
        long birthAdoptionTaxCredit,
        long standardTaxCredit,
        AppliedAmount taxCredit,
        long determinedTax,
        long prepaidTax,
        long balance,
        List<String> warnings,
        List<String> assumptions
) {

    public YearEndCalculationResult {
        warnings = List.copyOf(warnings);
        assumptions = List.copyOf(assumptions);
    }

    /** 신청액과 한도 안에서 실제 적용된 금액 */
    public record AppliedAmount(long requested, long applied) {

        public long notApplied() {
            return requested - applied;
        }
    }

    /** 추가공제 내역 */
    public record AdditionalDeduction(long elderly, long disabled, long woman, long singleParent) {

        public long total() {
            return elderly + disabled + woman + singleParent;
        }
    }

    /** 추가로 낼 세액 (없으면 0) */
    public long additionalPayment() {
        return Math.max(balance, 0);
    }

    /** 돌려받을 세액 (없으면 0) */
    public long refund() {
        return Math.max(-balance, 0);
    }
}
