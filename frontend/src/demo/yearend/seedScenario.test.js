// 체험 모드 초기 데이터(D2-1)의 2026년 귀속 연말정산 모의 계산 시나리오 고정 (실행: npm test)
// 기대값은 같은 입력으로 백엔드 Java YearEndCalculator(2026-09-30 소스)를 실행해 얻은 값이다. 시뮬레이션 금액이며 공식 결과가 아니다.
// - 확정된 2026년 1~8월 급여만 사용 (9월 작성 중 급여 제외)
// - DEMO002 만 입력 자료(배우자 + 부양가족 1명, 자녀세액공제 1명), 나머지는 입력 자료 없음 → 본인 기본공제만
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSeedData, PAY_ITEMS } from '../seed.js'
import { calculateYearEnd } from './calculator.js'
import { RULE_NOTE_2026 } from './taxRules.js'
import { yearEndPayrollTotals } from './payrollTotals.js'

const itemById = (id) => PAY_ITEMS.find((item) => item.id === id)

/** 초기 데이터에서 사원별 2026년 확정 급여 합계와 입력 자료를 꺼내 계산 (D2-4 API 가 할 일을 테스트에서 흉내 냄) */
function seedResults() {
  const seed = createSeedData()
  const confirmed = new Map(seed.payrollPeriods.filter((p) => p.year === 2026 && p.status === 'CONFIRMED').map((p) => [p.id, p]))
  return seed.employees.map((employee) => {
    const payrolls = seed.payrolls
      .filter((p) => p.employeeId === employee.id && confirmed.has(p.periodId))
      .map((p) => ({ month: confirmed.get(p.periodId).month, lines: p.lines }))
      .sort((a, b) => a.month - b.month)
    const totals = yearEndPayrollTotals(payrolls, itemById)
    const personal = seed.yearEndInputs.find((i) => i.employeeId === employee.id && i.taxYear === 2026) ?? null
    const result = calculateYearEnd({
      taxYear: 2026, totalSalary: totals.totalSalary, insurancePremium: totals.insurancePremium,
      pensionPremium: totals.nationalPension, prepaidTax: totals.incomeTax, personal,
    })
    return { employeeNo: employee.employeeNo, totals, result }
  })
}

// [사번, 총급여, 보험료, 국민연금, 기납부세액, 과세표준, 산출세액, 결정세액, 차액(양수 추가 납부, 음수 환급)] — 백엔드 Java 계산 결과
const EXPECTED = [
  ['DEMO001', 25_500_000, 1_000_000, 1_080_000, 920_000, 12_845_000, 770_700, 346_815, -573_185],
  ['DEMO002', 30_600_000, 800_000, 1_296_000, 1_640_000, 14_164_000, 864_600, 139_070, -1_500_930],
  ['DEMO003', 22_950_000, 964_000, 972_000, 640_000, 10_821_500, 649_290, 292_181, -347_819],
  ['DEMO004', 27_200_000, 1_255_040, 1_152_000, 570_000, 13_962_960, 837_777, 377_000, -193_000],
  ['DEMO005', 22_100_000, 1_019_360, 936_000, 200_000, 10_079_640, 604_778, 272_151, 72_151],
  ['DEMO006', 24_000_000, 1_176_960, 1_080_000, 1_500_000, 11_393_040, 683_582, 307_612, -1_192_388],
  ['DEMO007', 23_800_000, 1_098_480, 1_008_000, 370_000, 11_373_520, 682_411, 307_085, -62_915],
  ['DEMO008', 21_250_000, 980_720, 900_000, 190_000, 9_431_780, 565_906, 254_658, 64_658],
]

test('초기 데이터 8명: 급여 합계와 과세표준·산출세액·결정세액·차액이 백엔드 계산과 같다', () => {
  const results = seedResults()
  assert.deepEqual(results.map(({ employeeNo, totals: t, result: r }) => [
    employeeNo, t.totalSalary, t.insurancePremium, t.nationalPension, t.incomeTax, r.taxBase, r.calculatedTax, r.determinedTax, r.balance,
  ]), EXPECTED)
})

test('초기 데이터: 환급 6명, 추가 납부 2명(DEMO005, DEMO008)', () => {
  const results = seedResults()
  assert.deepEqual(results.filter((x) => x.result.balance < 0).map((x) => x.employeeNo), ['DEMO001', 'DEMO002', 'DEMO003', 'DEMO004', 'DEMO006', 'DEMO007'])
  assert.deepEqual(results.filter((x) => x.result.balance > 0).map((x) => x.employeeNo), ['DEMO005', 'DEMO008'])
  assert.deepEqual(results.filter((x) => x.result.balance > 0).map((x) => x.result.additionalPayment), [72_151, 64_658])
})

test('DEMO002 (입력 자료 있음): 단계별 금액 전체', () => {
  const { result: r } = seedResults().find((x) => x.employeeNo === 'DEMO002')
  const { warnings, assumptions, ...amounts } = r
  assert.deepEqual(amounts, {
    taxYear: 2026, rulesYear: 2026,
    totalSalary: 30_600_000,
    earnedIncomeDeduction: 9_840_000, // 750만 + (3,060만 − 1,500만) × 15%
    earnedIncomeAmount: 20_760_000,
    basicDeduction: 4_500_000, // 본인 + 배우자 + 부양가족 1명 = 3명 × 150만
    additionalDeduction: { elderly: 0, disabled: 0, woman: 0, singleParent: 0 },
    personalDeduction: { requested: 4_500_000, applied: 4_500_000 },
    insuranceDeduction: { requested: 800_000, applied: 800_000 },
    pensionDeduction: { requested: 1_296_000, applied: 1_296_000 },
    taxBase: 14_164_000,
    calculatedTax: 864_600, // 84만 + (1,416.4만 − 1,400만) × 15%
    earnedIncomeTaxCredit: 475_530, // 864,600 × 55% (한도 74만 이내)
    childTaxCredit: 250_000,
    birthAdoptionTaxCredit: 0,
    standardTaxCredit: 0, // 보험료 공제가 있으므로 미적용
    taxCredit: { requested: 725_530, applied: 725_530 },
    determinedTax: 139_070,
    prepaidTax: 1_640_000,
    balance: -1_500_930,
    additionalPayment: 0,
    refund: 1_500_930,
  })
  assert.deepEqual(warnings, [RULE_NOTE_2026])
  assert.equal(assumptions.length, 3)
})

test('입력 자료가 없는 7명: 2026년 규칙 안내 + "본인 기본공제만" 안내, 기본공제 150만원', () => {
  for (const { employeeNo, result } of seedResults().filter((x) => x.employeeNo !== 'DEMO002')) {
    assert.equal(result.rulesYear, 2026, employeeNo)
    assert.equal(result.basicDeduction, 1_500_000, employeeNo)
    assert.deepEqual(result.warnings, [RULE_NOTE_2026, '연말정산 입력 자료가 없어 본인 기본공제만 적용했습니다.'], employeeNo)
  }
})

test('초기 데이터: 9월 작성 중 급여는 합계에 없음, 퇴사자 DEMO006 은 1~6월 6건, 식대 한도 초과 달 없음', () => {
  const results = seedResults()
  assert.deepEqual(results.map((x) => x.totals.payrollCount), [8, 8, 8, 8, 8, 6, 8, 8])
  for (const x of results) assert.deepEqual(x.totals.mealOverLimitMonths, [], x.employeeNo)
})
