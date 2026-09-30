// ------------------------------------------------------------------
// 체험 모드 연말정산 규칙 (포트폴리오용 모의 계산, 전문가 검증 전) — 순수 계산, 저장소·네트워크 없음
// 원본: 백엔드 yearend/calculator/TaxRules.java · TaxRules2025.java · TaxRules2026.java 를 그대로 옮겼다.
// - 금액은 원 단위 정수, 비율은 "금액 × 분자 / 분모" 로 계산하고 원 미만은 버린다(가정, Java long 나눗셈과 같게 Math.trunc).
// - 규칙 근거: docs/tax-rules/year-end-settlement-2025.md, docs/tax-rules/year-end-settlement-2026.md
// ------------------------------------------------------------------

const MAN = 10_000 // 만원

/** Java long 정수 나눗셈과 같은 결과 (0 방향 버림) */
const div = (a, b) => Math.trunc(a / b)

/** 2025년 귀속 규칙 (소득세법 제47·50·51·55·59·59의2·59의4조) */
export const TAX_RULES_2025 = {
  year: 2025,

  /** 근로소득공제 (총급여 구간별, 한도 2천만원, 총급여보다 클 수 없음) */
  earnedIncomeDeduction(totalSalary) {
    let deduction
    if (totalSalary <= 500 * MAN) {
      deduction = div(totalSalary * 70, 100)
    } else if (totalSalary <= 1_500 * MAN) {
      deduction = 350 * MAN + div((totalSalary - 500 * MAN) * 40, 100)
    } else if (totalSalary <= 4_500 * MAN) {
      deduction = 750 * MAN + div((totalSalary - 1_500 * MAN) * 15, 100)
    } else if (totalSalary <= 10_000 * MAN) {
      deduction = 1_200 * MAN + div((totalSalary - 4_500 * MAN) * 5, 100)
    } else {
      deduction = 1_475 * MAN + div((totalSalary - 10_000 * MAN) * 2, 100)
    }
    return Math.min(Math.min(deduction, 2_000 * MAN), totalSalary)
  },

  /** 기본세율로 계산한 산출세액 */
  basicTax(taxBase) {
    if (taxBase <= 1_400 * MAN) return div(taxBase * 6, 100)
    if (taxBase <= 5_000 * MAN) return 84 * MAN + div((taxBase - 1_400 * MAN) * 15, 100)
    if (taxBase <= 8_800 * MAN) return 624 * MAN + div((taxBase - 5_000 * MAN) * 24, 100)
    if (taxBase <= 15_000 * MAN) return 1_536 * MAN + div((taxBase - 8_800 * MAN) * 35, 100)
    if (taxBase <= 30_000 * MAN) return 3_706 * MAN + div((taxBase - 15_000 * MAN) * 38, 100)
    if (taxBase <= 50_000 * MAN) return 9_406 * MAN + div((taxBase - 30_000 * MAN) * 40, 100)
    if (taxBase <= 100_000 * MAN) return 17_406 * MAN + div((taxBase - 50_000 * MAN) * 42, 100)
    return 38_406 * MAN + div((taxBase - 100_000 * MAN) * 45, 100)
  },

  /** 근로소득세액공제 공제액 (한도 적용 전) */
  earnedIncomeTaxCreditAmount(calculatedTax) {
    if (calculatedTax <= 130 * MAN) return div(calculatedTax * 55, 100)
    return 715_000 + div((calculatedTax - 130 * MAN) * 30, 100)
  },

  /** 근로소득세액공제 한도 (총급여 기준) */
  earnedIncomeTaxCreditLimit(totalSalary) {
    if (totalSalary <= 3_300 * MAN) return 74 * MAN
    if (totalSalary <= 7_000 * MAN) return Math.max(66 * MAN, 74 * MAN - div((totalSalary - 3_300 * MAN) * 8, 1000))
    if (totalSalary <= 12_000 * MAN) return Math.max(50 * MAN, 66 * MAN - div(totalSalary - 7_000 * MAN, 2))
    return Math.max(20 * MAN, 50 * MAN - div(totalSalary - 12_000 * MAN, 2))
  },

  /** 자녀세액공제 중 자녀 수에 따른 금액 */
  childTaxCredit(childCount) {
    if (childCount <= 0) return 0
    if (childCount === 1) return 25 * MAN
    if (childCount === 2) return 55 * MAN
    return 55 * MAN + (childCount - 2) * 40 * MAN
  },

  /** 자녀세액공제 중 출산·입양 금액 */
  birthAdoptionTaxCredit(firstCount, secondCount, thirdPlusCount) {
    return firstCount * 30 * MAN + secondCount * 50 * MAN + thirdPlusCount * 70 * MAN
  },

  basicDeductionPerPerson: () => 150 * MAN,
  elderlyDeductionPerPerson: () => 100 * MAN,
  disabledDeductionPerPerson: () => 200 * MAN,
  womanDeduction: () => 50 * MAN,
  womanDeductionIncomeLimit: () => 3_000 * MAN,
  singleParentDeduction: () => 100 * MAN,
  standardTaxCredit: () => 13 * MAN,

  /** 이 규칙의 확인 상태 안내 (없으면 빈 목록) */
  ruleNotes: () => [],
}

/** TaxRules2026.RULE_NOTE 와 같은 문구 */
export const RULE_NOTE_2026 =
  '2026년 귀속 규칙은 소득세법과 부칙(법률 제21548호 등)으로 확인한 범위만 반영했습니다. ' +
  '금액 계산은 현재 2025년 귀속 규칙을 그대로 사용합니다(법령 개정 이력상 금액 변경이 없는 것으로 추정, 금액표 원문 재확인 전). ' +
  '국세청 2026년 귀속 안내는 확인하지 못했고 전문가 검증 전입니다.'

/**
 * 2026년 귀속 규칙: 금액 계산은 모두 2025년 규칙에 위임하고, 확인 상태 안내만 덧붙인다 (TaxRules2026.java 와 같음).
 * 자녀세액공제 나이 기준은 계산에 쓰지 않으므로 childCreditAgeGuide.js 에서 안내만 한다.
 */
export const TAX_RULES_2026 = {
  ...TAX_RULES_2025,
  year: 2026,
  ruleNotes: () => [RULE_NOTE_2026],
}

/** 근로소득세액공제 = min(공제액, 한도) (TaxRules.earnedIncomeTaxCredit 기본 메서드) */
export function earnedIncomeTaxCredit(rules, calculatedTax, totalSalary) {
  return Math.min(rules.earnedIncomeTaxCreditAmount(calculatedTax), rules.earnedIncomeTaxCreditLimit(totalSalary))
}

/** 규칙이 등록되지 않은 연도에 대신 적용하는 규칙 (YearEndCalculator.FALLBACK_RULES) */
export const FALLBACK_RULES = TAX_RULES_2025

/** 등록된 귀속연도별 규칙 (2025, 2026) */
export const RULES_BY_YEAR = { 2025: TAX_RULES_2025, 2026: TAX_RULES_2026 }
