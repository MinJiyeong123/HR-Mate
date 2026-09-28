package com.hrmate.yearend.calculator;

/**
 * 자녀세액공제 대상 자녀의 연령 기준 안내 (계산에는 쓰지 않는다. 사용자가 "공제 대상 자녀 수"를 판단할 때 참고)
 *
 * <p>근거: docs/tax-rules/year-end-settlement-2026.md (2026-09-29 확인, 전문가 검증 전)
 * <ul>
 *   <li>2025년 귀속: 8세 이상 — 소득세법(2026. 4. 21. 개정 전 문구), 국세청 2025년 귀속 안내</li>
 *   <li>2026~2029년 귀속: 9·10·11·12세 이상 — 소득세법 부칙(법률 제21548호) 제2조②</li>
 *   <li>2030년 이후 귀속: 13세 이상 — 소득세법 제59조의2①</li>
 *   <li>2024년 이하: 확인하지 않음</li>
 *   <li>2017년생: 부칙 제2조③(제2항 미적용) — 영향은 해석 미확정이므로 주의 문구로만 안내</li>
 * </ul>
 * 계산 규칙이 등록된 연도(2025·2026) 외에는 계산이 2025년 규칙으로 대체되므로, 연령 기준은 "참고"로 표시한다.
 *
 * @param minimumAge 연령 기준(세 이상). 확인하지 않은 연도는 null
 * @param basis      근거와 확인 상태 안내
 * @param caution    2017년생 주의 문구. 해당 없는 연도는 null
 */
public record ChildCreditAgeGuide(int taxYear, Integer minimumAge, String basis, String caution) {

    private static final String NOT_VERIFIED = "국세청 안내 미확인 · 전문가 검증 전";
    private static final String FALLBACK = "이 연도는 계산 규칙이 등록되지 않아 계산은 2025년 귀속 규칙으로 대체됩니다.";

    public static ChildCreditAgeGuide forYear(int taxYear) {
        if (taxYear <= 2024) {
            return new ChildCreditAgeGuide(taxYear, null,
                    "이 연도의 나이 기준은 확인하지 않았습니다. " + FALLBACK, null);
        }
        if (taxYear == 2025) {
            return new ChildCreditAgeGuide(taxYear, 8,
                    "2025년 귀속: 소득세법(2026. 4. 21. 개정 전 문구)·국세청 2025년 귀속 안내 기준 · 전문가 검증 전", null);
        }
        if (taxYear == 2026) {
            return new ChildCreditAgeGuide(taxYear, 9,
                    "2026년 귀속: 소득세법 부칙(법률 제21548호) 제2조② 기준 · " + NOT_VERIFIED, caution2017(taxYear));
        }
        if (taxYear <= 2029) {
            return new ChildCreditAgeGuide(taxYear, taxYear - 2017,
                    "참고: " + taxYear + "년 귀속 연령 기준은 소득세법 부칙(법률 제21548호) 제2조② 기준입니다. "
                            + FALLBACK + " " + NOT_VERIFIED,
                    caution2017(taxYear));
        }
        return new ChildCreditAgeGuide(taxYear, 13,
                "참고: " + taxYear + "년 귀속 연령 기준은 소득세법 제59조의2①(13세 이상) 기준입니다. "
                        + FALLBACK + " " + NOT_VERIFIED,
                null);
    }

    /** 2017년생 주의: 법령 문구(사실)와 조문 구조에 따른 해석(가능성)을 나눠 적는다. */
    private static String caution2017(int taxYear) {
        return "⚠ 2017년생 자녀 — [법령] 소득세법 부칙(법률 제21548호) 제2조③은 2017년에 출생한 자녀에게 "
                + "연령 단계 기준(같은 조 제2항)을 적용하지 않는다고 정합니다. "
                + "[해석] 조문 구조상 본문 기준(13세 이상)이 적용되어 " + taxYear + "년 귀속에는 공제 대상이 아닐 수 있습니다"
                + "(해석 미확정, 아동수당 연령 특례와 연계된 것으로 보임). 전문가 확인이 필요합니다.";
    }
}
