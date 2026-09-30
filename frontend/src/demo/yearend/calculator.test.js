// 연말정산 모의 계산 전체 흐름·입력 규칙 테스트 (실행: npm test). 금액은 모두 가상 값이다.
// 백엔드 YearEndCalculatorTest·PersonalDeductionInputTest 의 입력·기대값을 그대로 옮겼다.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ASSUMPTIONS, basicDeductionCount, calculateYearEnd, SELF_ONLY, validatePersonalDeductionInput } from './calculator.js'
import { RULE_NOTE_2026 } from './taxRules.js'

const FIELDS = ['spouseDeduction', 'dependentCount', 'elderlyCount', 'disabledCount', 'womanDeduction', 'singleParentDeduction', 'childCreditCount', 'birthFirstCount', 'birthSecondCount', 'birthThirdPlusCount']
const input = (...values) => Object.fromEntries(FIELDS.map((k, i) => [k, values[i]]))
/** YearEndCalculatorTest.personal(spouse, dependents, woman, singleParent, children, birthFirst) */
const personal = (spouse, dependents, woman, singleParent, children, birthFirst) => input(spouse, dependents, 0, 0, woman, singleParent, children, birthFirst, 0, 0)
const calculate = (taxYear, totalSalary, insurancePremium, pensionPremium, prepaidTax, p) =>
  calculateYearEnd({ taxYear, totalSalary, insurancePremium, pensionPremium, prepaidTax, personal: p })
const applied = (requested, appliedAmount) => ({ requested, applied: appliedAmount })

test('일반적인 계산 흐름과 환급 (총급여 3,600만, 배우자 + 자녀 1명, 보험료 150만, 국민연금 162만, 기납부 100만)', () => {
  const r = calculate(2025, 36_000_000, 1_500_000, 1_620_000, 1_000_000, personal(true, 1, false, false, 1, 0))
  assert.equal(r.rulesYear, 2025)
  assert.equal(r.earnedIncomeDeduction, 10_650_000) // 750만 + 2,100만 × 15%
  assert.equal(r.earnedIncomeAmount, 25_350_000)
  assert.equal(r.basicDeduction, 4_500_000) // 3명 × 150만
  assert.deepEqual(r.personalDeduction, applied(4_500_000, 4_500_000))
  assert.deepEqual(r.insuranceDeduction, applied(1_500_000, 1_500_000))
  assert.deepEqual(r.pensionDeduction, applied(1_620_000, 1_620_000))
  assert.equal(r.taxBase, 17_730_000) // 2,535만 − 450만 − 150만 − 162만
  assert.equal(r.calculatedTax, 1_399_500) // 84만 + 373만 × 15%
  assert.equal(r.earnedIncomeTaxCredit, 716_000) // 공제액 744,850, 한도 716,000
  assert.equal(r.childTaxCredit, 250_000)
  assert.equal(r.standardTaxCredit, 0) // 보험료 공제가 있으므로 미적용
  assert.deepEqual(r.taxCredit, applied(966_000, 966_000))
  assert.equal(r.determinedTax, 433_500)
  assert.equal(r.balance, -566_500)
  assert.equal(r.refund, 566_500)
  assert.equal(r.additionalPayment, 0)
  assert.deepEqual(r.warnings, [])
  assert.deepEqual(r.assumptions, ASSUMPTIONS)
  assert.equal(r.assumptions.length, 3)
})

test('기납부세액이 적으면 추가 납부', () => {
  const r = calculate(2025, 36_000_000, 1_500_000, 1_620_000, 0, personal(true, 1, false, false, 1, 0))
  assert.deepEqual([r.balance, r.additionalPayment, r.refund], [433_500, 433_500, 0])
})

test('보험료 공제가 없으면 표준세액공제(13만원)를 적용하고 차이가 없을 수 있다', () => {
  const r = calculate(2025, 36_000_000, 0, 0, 1_471_500, SELF_ONLY)
  assert.deepEqual([r.taxBase, r.calculatedTax, r.standardTaxCredit, r.determinedTax, r.balance], [23_850_000, 2_317_500, 130_000, 1_471_500, 0])
  assert.deepEqual(r.warnings, [])
})

test('입력 자료 없음 + 규칙이 없는 연도(2027 → 2025 규칙) + 공제가 소득을 넘는 경우: 경고 4개 순서·문구', () => {
  const r = calculate(2027, 3_200_000, 0, 0, 100_000, null)
  assert.deepEqual([r.taxYear, r.rulesYear, r.earnedIncomeAmount], [2027, 2025, 960_000])
  assert.deepEqual(r.personalDeduction, applied(1_500_000, 960_000))
  assert.deepEqual([r.taxBase, r.calculatedTax, r.determinedTax, r.refund], [0, 0, 0, 100_000])
  assert.deepEqual(r.taxCredit, applied(130_000, 0)) // 표준세액공제만, 산출세액 0
  assert.deepEqual(r.warnings, [
    '2027년 귀속 급여에 2025년 귀속 규칙을 적용한 결과입니다. 2027년 개정 사항은 반영되지 않았습니다.',
    '연말정산 입력 자료가 없어 본인 기본공제만 적용했습니다.',
    '인적공제 중 540,000원은 한도 초과로 적용되지 않았습니다.',
    '세액공제 중 130,000원은 산출세액을 넘어 적용되지 않았습니다.',
  ])
})

test('2026 은 등록된 2026년 규칙으로 계산하고 금액은 2025와 같다 (대체 경고 대신 확인 상태 안내)', () => {
  const p = personal(true, 1, false, false, 1, 0)
  const y2025 = calculate(2025, 36_000_000, 1_500_000, 1_620_000, 1_000_000, p)
  const y2026 = calculate(2026, 36_000_000, 1_500_000, 1_620_000, 1_000_000, p)
  assert.equal(y2026.rulesYear, 2026)
  for (const key of ['taxBase', 'calculatedTax', 'determinedTax', 'balance']) assert.equal(y2026[key], y2025[key], key)
  assert.deepEqual(y2026.taxCredit, y2025.taxCredit)
  assert.equal(y2026.determinedTax, 433_500)
  assert.equal(y2026.balance, -566_500)
  assert.deepEqual(y2025.warnings, [])
  assert.deepEqual(y2026.warnings, [RULE_NOTE_2026])
})

test('2024 는 2025년 규칙으로 대체하고 경고한다', () => {
  const r = calculate(2024, 36_000_000, 0, 0, 1_471_500, SELF_ONLY)
  assert.equal(r.rulesYear, 2025)
  assert.equal(r.balance, 0)
  assert.deepEqual(r.warnings, ['2024년 귀속 급여에 2025년 귀속 규칙을 적용한 결과입니다. 2024년 개정 사항은 반영되지 않았습니다.'])
})

test('연금보험료공제는 남은 소득 안에서만 적용된다', () => {
  const r = calculate(2025, 10_000_000, 2_000_000, 1_500_000, 0, SELF_ONLY)
  assert.equal(r.earnedIncomeDeduction, 5_500_000)
  assert.deepEqual(r.insuranceDeduction, applied(2_000_000, 2_000_000))
  assert.deepEqual(r.pensionDeduction, applied(1_500_000, 1_000_000))
  assert.equal(r.taxBase, 0)
  assert.deepEqual(r.warnings, ['연금보험료공제 중 500,000원은 한도 초과로 적용되지 않았습니다.'])
})

test('부녀자 공제는 근로소득금액 3천만원 이하일 때만', () => {
  assert.equal(calculate(2025, 36_000_000, 0, 0, 0, personal(false, 1, true, false, 0, 0)).additionalDeduction.woman, 500_000)
  const notApplied = calculate(2025, 50_000_000, 0, 0, 0, personal(false, 1, true, false, 0, 0))
  assert.equal(notApplied.earnedIncomeAmount, 37_750_000)
  assert.equal(notApplied.additionalDeduction.woman, 0)
  assert.deepEqual(notApplied.warnings, ['근로소득금액이 30,000,000원을 넘어 부녀자 공제를 적용하지 않았습니다.'])
})

test('부녀자와 한부모를 모두 선택하면 한부모만 적용', () => {
  const r = calculate(2025, 36_000_000, 0, 0, 0, personal(false, 1, true, true, 0, 0))
  assert.equal(r.additionalDeduction.singleParent, 1_000_000)
  assert.equal(r.additionalDeduction.woman, 0)
  assert.equal(r.personalDeduction.requested, 4_000_000) // 기본 2명 300만 + 한부모 100만
  assert.deepEqual(r.warnings, ['부녀자 공제와 한부모 공제를 모두 선택해 한부모 공제만 적용했습니다.'])
})

test('경로우대와 장애인 추가공제', () => {
  const r = calculate(2025, 60_000_000, 0, 0, 0, input(true, 1, 1, 1, false, false, 0, 0, 0, 0))
  assert.deepEqual(r.additionalDeduction, { elderly: 1_000_000, disabled: 2_000_000, woman: 0, singleParent: 0 })
  assert.equal(r.personalDeduction.requested, 7_500_000) // 기본 3명 450만 + 100만 + 200만
})

test('자녀 수와 출산·입양 세액공제', () => {
  const r = calculate(2025, 60_000_000, 0, 0, 0, personal(true, 3, false, false, 3, 1))
  assert.equal(r.childTaxCredit, 950_000) // 3명: 55만 + 40만
  assert.equal(r.birthAdoptionTaxCredit, 300_000) // 첫째
})

test('금액이나 연도가 범위를 벗어나면 거부한다', () => {
  assert.throws(() => calculate(2025, -1, 0, 0, 0, null), RangeError)
  assert.throws(() => calculate(1999, 0, 0, 0, 0, null), RangeError)
  assert.throws(() => calculate(2101, 0, 0, 0, 0, null), RangeError)
})

test('계산은 입력을 바꾸지 않고, 같은 입력이면 항상 같은 결과 (결정적)', () => {
  const p = personal(true, 1, false, false, 1, 0)
  const before = JSON.stringify(p)
  const a = calculate(2026, 30_600_000, 800_000, 1_296_000, 1_640_000, p)
  const b = calculate(2026, 30_600_000, 800_000, 1_296_000, 1_640_000, p)
  assert.deepEqual(a, b)
  assert.equal(JSON.stringify(p), before)
})

// ---------- 인적공제 입력 규칙 (PersonalDeductionInputTest) ----------

const rejected = (values, messagePart) => {
  assert.throws(() => validatePersonalDeductionInput(input(...values)), (e) => e instanceof RangeError && e.message.includes(messagePart))
}

test('입력: 정상 입력과 기본공제 대상자 수', () => {
  const value = input(true, 3, 2, 1, false, false, 2, 1, 0, 0)
  validatePersonalDeductionInput(value)
  assert.equal(basicDeductionCount(value), 5)
  assert.equal(basicDeductionCount(SELF_ONLY), 1)
})

test('입력: 부양가족 인원은 0~20명', () => {
  validatePersonalDeductionInput(input(false, 20, 0, 0, false, false, 0, 0, 0, 0))
  rejected([false, 21, 0, 0, false, false, 0, 0, 0, 0], '부양가족 인원')
  rejected([false, -1, 0, 0, false, false, 0, 0, 0, 0], '부양가족 인원')
})

test('입력: 경로우대와 장애인은 기본공제 대상자 수 이하', () => {
  validatePersonalDeductionInput(input(true, 1, 3, 3, false, false, 0, 0, 0, 0))
  rejected([true, 1, 4, 0, false, false, 0, 0, 0, 0], '경로우대')
  rejected([false, 0, 0, 2, false, false, 0, 0, 0, 0], '장애인')
})

test('입력: 배우자 기본공제와 한부모는 함께 선택할 수 없다 (부녀자 + 한부모는 허용)', () => {
  rejected([true, 1, 0, 0, false, true, 0, 0, 0, 0], '한부모')
  validatePersonalDeductionInput(input(false, 1, 0, 0, true, true, 0, 0, 0, 0))
})

test('입력: 자녀세액공제 대상은 부양가족 인원 이하', () => {
  validatePersonalDeductionInput(input(false, 2, 0, 0, false, false, 2, 0, 0, 0))
  rejected([false, 2, 0, 0, false, false, 3, 0, 0, 0], '자녀세액공제')
})

test('입력: 출산·입양 인원 범위와 합계', () => {
  validatePersonalDeductionInput(input(false, 3, 0, 0, false, false, 0, 1, 1, 1))
  rejected([false, 3, 0, 0, false, false, 0, 2, 0, 0], '첫째')
  rejected([false, 3, 0, 0, false, false, 0, 0, 2, 0], '둘째')
  rejected([false, 20, 0, 0, false, false, 0, 0, 0, 11], '셋째 이상')
  rejected([false, 1, 0, 0, false, false, 0, 1, 1, 0], '출산·입양 자녀 수의 합')
})

test('입력 규칙 위반은 계산 전에 거부한다', () => {
  assert.throws(() => calculate(2025, 30_000_000, 0, 0, 0, input(true, 1, 0, 0, false, true, 0, 0, 0, 0)), RangeError)
})
