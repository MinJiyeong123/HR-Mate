// ------------------------------------------------------------------
// 자녀세액공제 대상 자녀의 연령 기준 안내 (계산에는 쓰지 않는다) — 순수 함수
// 원본: 백엔드 yearend/calculator/ChildCreditAgeGuide.java (같은 문구)
// 근거: docs/tax-rules/year-end-settlement-2026.md (전문가 검증 전)
// ------------------------------------------------------------------

const NOT_VERIFIED = '국세청 안내 미확인 · 전문가 검증 전'
const FALLBACK = '이 연도는 계산 규칙이 등록되지 않아 계산은 2025년 귀속 규칙으로 대체됩니다.'

/** 2017년생 주의: 법령 문구(사실)와 조문 구조에 따른 해석(가능성)을 나눠 적는다. */
function caution2017(taxYear) {
  return '⚠ 2017년생 자녀 — [법령] 소득세법 부칙(법률 제21548호) 제2조③은 2017년에 출생한 자녀에게 ' +
    '연령 단계 기준(같은 조 제2항)을 적용하지 않는다고 정합니다. ' +
    `[해석] 조문 구조상 본문 기준(13세 이상)이 적용되어 ${taxYear}년 귀속에는 공제 대상이 아닐 수 있습니다` +
    '(해석 미확정, 아동수당 연령 특례와 연계된 것으로 보임). 전문가 확인이 필요합니다.'
}

/**
 * @returns { taxYear, minimumAge(확인하지 않은 연도는 null), basis, caution(해당 없으면 null) }
 */
export function childCreditAgeGuide(taxYear) {
  if (taxYear <= 2024) {
    return { taxYear, minimumAge: null, basis: `이 연도의 나이 기준은 확인하지 않았습니다. ${FALLBACK}`, caution: null }
  }
  if (taxYear === 2025) {
    return { taxYear, minimumAge: 8, basis: '2025년 귀속: 소득세법(2026. 4. 21. 개정 전 문구)·국세청 2025년 귀속 안내 기준 · 전문가 검증 전', caution: null }
  }
  if (taxYear === 2026) {
    return { taxYear, minimumAge: 9, basis: `2026년 귀속: 소득세법 부칙(법률 제21548호) 제2조② 기준 · ${NOT_VERIFIED}`, caution: caution2017(taxYear) }
  }
  if (taxYear <= 2029) {
    return {
      taxYear,
      minimumAge: taxYear - 2017,
      basis: `참고: ${taxYear}년 귀속 연령 기준은 소득세법 부칙(법률 제21548호) 제2조② 기준입니다. ${FALLBACK} ${NOT_VERIFIED}`,
      caution: caution2017(taxYear),
    }
  }
  return {
    taxYear,
    minimumAge: 13,
    basis: `참고: ${taxYear}년 귀속 연령 기준은 소득세법 제59조의2①(13세 이상) 기준입니다. ${FALLBACK} ${NOT_VERIFIED}`,
    caution: null,
  }
}
