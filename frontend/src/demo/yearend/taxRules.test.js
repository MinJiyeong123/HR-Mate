// 연말정산 규칙 단위 테스트 (실행: npm test)
// 백엔드 TaxRules2025Test·TaxRules2026Test 의 입력·기대값을 그대로 옮겼다 (docs/tax-rules 표·공식으로 손 계산, 원 미만 버림).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { earnedIncomeTaxCredit, RULE_NOTE_2026, TAX_RULES_2025 as rules, TAX_RULES_2026 as rules2026 } from './taxRules.js'

const table = (rows, fn) => {
  for (const [input, expected] of rows) assert.equal(fn(input), expected, `입력 ${input}`)
}

test('2025: 국세청 사례 — 총급여 3,380만원의 근로소득공제 1,032만원, 과세표준 2,000만원의 산출세액 174만원', () => {
  assert.equal(rules.earnedIncomeDeduction(33_800_000), 10_320_000)
  assert.equal(rules.basicTax(20_000_000), 1_740_000)
})

test('2025: 근로소득공제 구간과 한도 (경계값, 원 미만 버림)', () => {
  table([
    [0, 0], [1000, 700], [5_000_000, 3_500_000], [5_000_001, 3_500_000], [15_000_000, 7_500_000],
    [45_000_000, 12_000_000], [100_000_000, 14_750_000], [362_500_000, 20_000_000], [500_000_000, 20_000_000],
  ], (s) => rules.earnedIncomeDeduction(s))
})

test('2025: 기본세율 구간 경계', () => {
  table([
    [0, 0], [14_000_000, 840_000], [50_000_000, 6_240_000], [88_000_000, 15_360_000], [150_000_000, 37_060_000],
    [300_000_000, 94_060_000], [500_000_000, 174_060_000], [1_000_000_000, 384_060_000], [1_100_000_000, 429_060_000],
  ], (b) => rules.basicTax(b))
})

test('2025: 근로소득세액공제 공제액 (130만원 경계, 원 미만 버림)', () => {
  table([[1_000_000, 550_000], [1_300_000, 715_000], [1_300_001, 715_000], [2_300_000, 1_015_000]], (t) => rules.earnedIncomeTaxCreditAmount(t))
})

test('2025: 근로소득세액공제 한도 (총급여 구간·최소 금액)', () => {
  table([
    [33_000_000, 740_000], [38_000_000, 700_000], [43_000_000, 660_000], [70_000_000, 660_000], [70_100_000, 610_000],
    [80_000_000, 500_000], [120_000_000, 500_000], [120_200_000, 400_000], [130_000_000, 200_000],
  ], (s) => rules.earnedIncomeTaxCreditLimit(s))
})

test('2025: 근로소득세액공제는 공제액과 한도 중 작은 금액', () => {
  assert.equal(earnedIncomeTaxCredit(rules, 2_300_000, 33_000_000), 740_000)
  assert.equal(earnedIncomeTaxCredit(rules, 1_000_000, 33_000_000), 550_000)
})

test('2025: 자녀세액공제(자녀 수), 출산·입양 세액공제', () => {
  table([[0, 0], [1, 250_000], [2, 550_000], [3, 950_000], [4, 1_350_000], [5, 1_750_000]], (c) => rules.childTaxCredit(c))
  assert.equal(rules.birthAdoptionTaxCredit(1, 0, 0), 300_000)
  assert.equal(rules.birthAdoptionTaxCredit(0, 1, 0), 500_000)
  assert.equal(rules.birthAdoptionTaxCredit(0, 0, 2), 1_400_000)
  assert.equal(rules.birthAdoptionTaxCredit(1, 1, 1), 1_500_000)
})

test('2025: 인적공제와 표준세액공제 금액', () => {
  assert.equal(rules.year, 2025)
  assert.equal(rules.basicDeductionPerPerson(), 1_500_000)
  assert.equal(rules.elderlyDeductionPerPerson(), 1_000_000)
  assert.equal(rules.disabledDeductionPerPerson(), 2_000_000)
  assert.equal(rules.womanDeduction(), 500_000)
  assert.equal(rules.womanDeductionIncomeLimit(), 30_000_000)
  assert.equal(rules.singleParentDeduction(), 1_000_000)
  assert.equal(rules.standardTaxCredit(), 130_000)
})

test('2026: 총급여 기준 계산(근로소득공제·세액공제 한도)은 2025와 같다', () => {
  for (const s of [0, 1_000, 5_000_000, 5_000_001, 15_000_000, 33_000_000, 33_800_000, 43_000_000, 45_000_000,
    70_000_000, 70_100_000, 80_000_000, 100_000_000, 120_000_000, 120_200_000, 130_000_000, 362_500_000, 500_000_000]) {
    assert.equal(rules2026.earnedIncomeDeduction(s), rules.earnedIncomeDeduction(s), `총급여 ${s}`)
    assert.equal(rules2026.earnedIncomeTaxCreditLimit(s), rules.earnedIncomeTaxCreditLimit(s), `총급여 ${s}`)
  }
})

test('2026: 세율과 근로소득세액공제 공제액은 2025와 같다', () => {
  for (const a of [0, 1_000_000, 1_300_000, 1_300_001, 2_300_000, 14_000_000, 20_000_000, 50_000_000, 88_000_000,
    150_000_000, 300_000_000, 500_000_000, 1_000_000_000, 1_100_000_000]) {
    assert.equal(rules2026.basicTax(a), rules.basicTax(a), `금액 ${a}`)
    assert.equal(rules2026.earnedIncomeTaxCreditAmount(a), rules.earnedIncomeTaxCreditAmount(a), `금액 ${a}`)
    assert.equal(earnedIncomeTaxCredit(rules2026, a, 36_000_000), earnedIncomeTaxCredit(rules, a, 36_000_000), `금액 ${a}`)
  }
})

test('2026: 자녀·출산입양·인적공제·표준세액공제는 2025와 같다', () => {
  for (let c = 0; c <= 5; c++) assert.equal(rules2026.childTaxCredit(c), rules.childTaxCredit(c))
  assert.equal(rules2026.birthAdoptionTaxCredit(1, 1, 2), rules.birthAdoptionTaxCredit(1, 1, 2))
  for (const key of ['basicDeductionPerPerson', 'elderlyDeductionPerPerson', 'disabledDeductionPerPerson', 'womanDeduction',
    'womanDeductionIncomeLimit', 'singleParentDeduction', 'standardTaxCredit']) {
    assert.equal(rules2026[key](), rules[key](), key)
  }
})

test('2026: 연도와 확인 상태 안내 (2025 는 안내 없음)', () => {
  assert.equal(rules2026.year, 2026)
  assert.deepEqual(rules2026.ruleNotes(), [RULE_NOTE_2026])
  assert.ok(RULE_NOTE_2026.includes('법률 제21548호'))
  assert.ok(RULE_NOTE_2026.includes('국세청 2026년 귀속 안내는 확인하지 못했고'))
  assert.ok(RULE_NOTE_2026.includes('전문가 검증 전'))
  assert.deepEqual(rules.ruleNotes(), [])
})
