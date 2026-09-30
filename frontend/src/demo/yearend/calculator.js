// ------------------------------------------------------------------
// 체험 모드 연말정산 모의 계산 (포트폴리오용, 전문가 검증 전) — 순수 계산, 저장소·네트워크 없음
// 원본: 백엔드 yearend/calculator/YearEndCalculator.java · YearEndCalculationInput.java · PersonalDeductionInput.java
//
// 계산 순서(docs/requirements-year-end.md 5장):
// 총급여 → 근로소득공제 → 인적공제 → 보험료 특별소득공제 → 연금보험료공제 → 과세표준 → 산출세액
// → 근로소득·자녀·표준세액공제 → 결정세액 → 기납부세액과 비교.
// 급여 데이터로만 알 수 있는 안내(식대 한도 초과 달, 작성 중 급여 제외, 퇴사자, 2017년생 주의)는 호출하는 쪽(D2-4 API)이 붙인다.
// ------------------------------------------------------------------
import { earnedIncomeTaxCredit, FALLBACK_RULES, RULES_BY_YEAR } from './taxRules.js'

export const MIN_YEAR = 2000
export const MAX_YEAR = 2100
export const MAX_DEPENDENT_COUNT = 20
export const MAX_BIRTH_THIRD_PLUS_COUNT = 10

/** 공식 자료로 확인하지 못해 가정한 계산 방식 (YearEndCalculator.ASSUMPTIONS 와 같은 문구·순서) */
export const ASSUMPTIONS = [
  '각 단계 비율 계산의 원 미만은 버렸습니다.',
  '세액공제 합계가 산출세액을 넘으면 결정세액은 0원으로 했습니다.',
  '소득공제 한도를 넘을 때 인적공제 → 보험료 공제 → 연금보험료공제 순으로 적용액을 표시했습니다(과세표준에는 영향 없음).',
]

/** 입력 자료가 없을 때: 본인 기본공제만 (PersonalDeductionInput.SELF_ONLY) */
export const SELF_ONLY = Object.freeze({
  spouseDeduction: false,
  dependentCount: 0,
  elderlyCount: 0,
  disabledCount: 0,
  womanDeduction: false,
  singleParentDeduction: false,
  childCreditCount: 0,
  birthFirstCount: 0,
  birthSecondCount: 0,
  birthThirdPlusCount: 0,
})

/** 기본공제 대상자 수 (본인 + 배우자 + 부양가족) */
export const basicDeductionCount = (personal) => 1 + (personal.spouseDeduction ? 1 : 0) + personal.dependentCount

function requireRange(value, min, max, message) {
  if (value < min || value > max) throw new RangeError(message)
}

/**
 * 인적공제 입력 규칙 검사 (PersonalDeductionInput 생성자와 같은 순서·문구). 위반하면 RangeError.
 * 공제 요건(나이·소득·동거 등) 판단은 사용자가 한다.
 */
export function validatePersonalDeductionInput(p) {
  requireRange(p.dependentCount, 0, MAX_DEPENDENT_COUNT, `부양가족 인원은 0~${MAX_DEPENDENT_COUNT}명으로 입력해 주세요.`)
  const basicCount = basicDeductionCount(p)
  requireRange(p.elderlyCount, 0, basicCount, `경로우대 인원은 기본공제 대상자 수(${basicCount}명) 이하로 입력해 주세요.`)
  requireRange(p.disabledCount, 0, basicCount, `장애인 인원은 기본공제 대상자 수(${basicCount}명) 이하로 입력해 주세요.`)
  if (p.spouseDeduction && p.singleParentDeduction) {
    throw new RangeError('배우자 기본공제와 한부모 공제는 함께 선택할 수 없습니다.')
  }
  requireRange(p.childCreditCount, 0, p.dependentCount, '자녀세액공제 대상 자녀 수는 부양가족 인원 이하로 입력해 주세요.')
  requireRange(p.birthFirstCount, 0, 1, '출산·입양 첫째는 0~1명으로 입력해 주세요.')
  requireRange(p.birthSecondCount, 0, 1, '출산·입양 둘째는 0~1명으로 입력해 주세요.')
  requireRange(p.birthThirdPlusCount, 0, MAX_BIRTH_THIRD_PLUS_COUNT, `출산·입양 셋째 이상은 0~${MAX_BIRTH_THIRD_PLUS_COUNT}명으로 입력해 주세요.`)
  if (p.birthFirstCount + p.birthSecondCount + p.birthThirdPlusCount > p.dependentCount) {
    throw new RangeError('출산·입양 자녀 수의 합은 부양가족 인원 이하로 입력해 주세요.')
  }
}

/** 계산 입력 검사 (YearEndCalculationInput 생성자와 같음). 위반하면 RangeError. */
function validateCalculationInput({ taxYear, totalSalary, insurancePremium, pensionPremium, prepaidTax }) {
  if (!Number.isInteger(taxYear) || taxYear < MIN_YEAR || taxYear > MAX_YEAR) {
    throw new RangeError(`귀속연도는 ${MIN_YEAR}~${MAX_YEAR} 사이여야 합니다.`)
  }
  for (const amount of [totalSalary, insurancePremium, pensionPremium, prepaidTax]) {
    if (!Number.isSafeInteger(amount) || amount < 0) throw new RangeError('금액은 0원 이상이어야 합니다.')
  }
}

/** String.format(Locale.KOREA, "%,d원") 과 같은 표기 */
export const won = (amount) => `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`

const appliedAmount = (requested, applied) => ({ requested, applied })
const notApplied = (amount) => amount.requested - amount.applied

/** 남은 소득 안에서만 공제를 적용하고, 넘는 금액은 안내한다. */
function apply(name, requested, remaining, warnings) {
  const amount = appliedAmount(requested, Math.min(requested, remaining))
  if (notApplied(amount) > 0) warnings.push(`${name} 중 ${won(notApplied(amount))}은 한도 초과로 적용되지 않았습니다.`)
  return amount
}

/** 추가공제: 한부모·부녀자를 모두 선택하면 한부모만, 부녀자는 근로소득금액 상한 이하일 때만 */
function additionalDeduction(rules, personal, earnedIncomeAmount, warnings) {
  const elderly = personal.elderlyCount * rules.elderlyDeductionPerPerson()
  const disabled = personal.disabledCount * rules.disabledDeductionPerPerson()
  const singleParent = personal.singleParentDeduction ? rules.singleParentDeduction() : 0
  let woman = 0
  if (personal.womanDeduction) {
    if (personal.singleParentDeduction) {
      warnings.push('부녀자 공제와 한부모 공제를 모두 선택해 한부모 공제만 적용했습니다.')
    } else if (earnedIncomeAmount > rules.womanDeductionIncomeLimit()) {
      warnings.push(`근로소득금액이 ${won(rules.womanDeductionIncomeLimit())}을 넘어 부녀자 공제를 적용하지 않았습니다.`)
    } else {
      woman = rules.womanDeduction()
    }
  }
  return { elderly, disabled, woman, singleParent }
}

/**
 * 연말정산 모의 계산 (YearEndCalculator.calculate 와 같은 순서·금액·경고)
 * @param input { taxYear, totalSalary, insurancePremium, pensionPremium, prepaidTax, personal }
 *        personal 이 null 이면 입력 자료 없음(본인 기본공제만)
 * @returns YearEndCalculationResult 와 같은 필드 (+ additionalPayment, refund)
 */
export function calculateYearEnd(input) {
  validateCalculationInput(input)
  const warnings = []
  let rules = RULES_BY_YEAR[input.taxYear]
  if (rules === undefined) {
    rules = FALLBACK_RULES
    warnings.push(`${input.taxYear}년 귀속 급여에 ${rules.year}년 귀속 규칙을 적용한 결과입니다. ${input.taxYear}년 개정 사항은 반영되지 않았습니다.`)
  }
  warnings.push(...rules.ruleNotes()) // 예: 2026년 규칙의 확인 상태(국세청 안내 미확인 등)
  let personal = input.personal ?? null
  if (personal === null) {
    personal = SELF_ONLY
    warnings.push('연말정산 입력 자료가 없어 본인 기본공제만 적용했습니다.')
  } else {
    validatePersonalDeductionInput(personal)
  }

  // 1~2. 총급여 → 근로소득공제 → 근로소득금액
  const totalSalary = input.totalSalary
  const earnedIncomeDeduction = rules.earnedIncomeDeduction(totalSalary)
  const earnedIncomeAmount = totalSalary - earnedIncomeDeduction

  // 3. 인적공제 (기본 + 추가), 근로소득금액 초과분은 없는 것으로 함
  const basicDeduction = basicDeductionCount(personal) * rules.basicDeductionPerPerson()
  const additional = additionalDeduction(rules, personal, earnedIncomeAmount, warnings)
  const additionalTotal = additional.elderly + additional.disabled + additional.woman + additional.singleParent
  let remaining = earnedIncomeAmount
  const personalDeduction = apply('인적공제', basicDeduction + additionalTotal, remaining, warnings)
  remaining -= personalDeduction.applied

  // 4. 보험료 특별소득공제 → 연금보험료공제 → 과세표준
  const insuranceDeduction = apply('보험료 공제', input.insurancePremium, remaining, warnings)
  remaining -= insuranceDeduction.applied
  const pensionDeduction = apply('연금보험료공제', input.pensionPremium, remaining, warnings)
  remaining -= pensionDeduction.applied
  const taxBase = remaining

  // 5. 산출세액
  const calculatedTax = rules.basicTax(taxBase)

  // 6. 세액공제: 표준세액공제는 보험료 특별소득공제 대상 금액이 없을 때만 (결정 3)
  const earnedCredit = earnedIncomeTaxCredit(rules, calculatedTax, totalSalary)
  const childTaxCredit = rules.childTaxCredit(personal.childCreditCount)
  const birthAdoptionTaxCredit = rules.birthAdoptionTaxCredit(personal.birthFirstCount, personal.birthSecondCount, personal.birthThirdPlusCount)
  const standardTaxCredit = input.insurancePremium === 0 ? rules.standardTaxCredit() : 0
  const creditTotal = earnedCredit + childTaxCredit + birthAdoptionTaxCredit + standardTaxCredit
  const taxCredit = appliedAmount(creditTotal, Math.min(creditTotal, calculatedTax))
  if (notApplied(taxCredit) > 0) {
    warnings.push(`세액공제 중 ${won(notApplied(taxCredit))}은 산출세액을 넘어 적용되지 않았습니다.`)
  }

  // 7. 결정세액 → 추가 납부 / 환급
  const determinedTax = calculatedTax - taxCredit.applied
  const balance = determinedTax - input.prepaidTax

  return {
    taxYear: input.taxYear,
    rulesYear: rules.year,
    totalSalary,
    earnedIncomeDeduction,
    earnedIncomeAmount,
    basicDeduction,
    additionalDeduction: additional,
    personalDeduction,
    insuranceDeduction,
    pensionDeduction,
    taxBase,
    calculatedTax,
    earnedIncomeTaxCredit: earnedCredit,
    childTaxCredit,
    birthAdoptionTaxCredit,
    standardTaxCredit,
    taxCredit,
    determinedTax,
    prepaidTax: input.prepaidTax,
    balance,
    additionalPayment: Math.max(balance, 0),
    refund: Math.max(-balance, 0),
    warnings,
    assumptions: [...ASSUMPTIONS],
  }
}
