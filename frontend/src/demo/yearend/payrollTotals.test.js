// 연말정산용 급여 합계 테스트 (실행: npm test)
// 백엔드 YearEndServiceTest "계산_결과는_확정_급여를_항목별로_합산하고_급여_안내를_붙인다" 의 급여·기대값을 옮겼다.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PAY_ITEMS } from '../seed.js'
import { calculateYearEnd } from './calculator.js'
import { MEAL_MONTHLY_LIMIT, yearEndPayrollTotals } from './payrollTotals.js'

const itemById = (id) => PAY_ITEMS.find((item) => item.id === id)
const line = (payItemId, amount) => ({ payItemId, amount })
// 기본급 300만, 식대, 건강 10만, 장기요양 1만, 고용 2만, 국민연금 13만5천, 소득세 5만 (+ 계산에 쓰지 않는 지방소득세 5천·기타공제 1만)
const payroll = (month, meal) => ({
  month,
  lines: [line(1, 3_000_000), line(4, meal), line(9, 100_000), line(10, 10_000), line(11, 20_000), line(8, 135_000), line(6, 50_000), line(7, 5_000), line(12, 10_000)],
})

test('항목 코드별 합산: 총급여 = 과세 지급, 보험료 = 건강 + 장기요양 + 고용, 지방소득세·기타공제는 제외', () => {
  const totals = yearEndPayrollTotals([payroll(1, 200_000), payroll(2, 250_000)], itemById)
  assert.deepEqual(totals, {
    payrollCount: 2,
    totalSalary: 6_000_000,
    nonTaxableEarnings: 450_000,
    healthInsurance: 200_000,
    longTermCare: 20_000,
    employmentInsurance: 40_000,
    nationalPension: 270_000,
    incomeTax: 100_000,
    mealOverLimitMonths: [2], // 식대 월 20만원 초과 달 (20만원 정확히는 초과 아님)
    insurancePremium: 260_000,
  })
  assert.equal(MEAL_MONTHLY_LIMIT, 200_000)
})

test('백엔드 서비스 테스트와 같은 결과: 과세표준 7만 → 결정세액 1,890 → 환급 98,110 (입력 자료 없음)', () => {
  const t = yearEndPayrollTotals([payroll(1, 200_000), payroll(2, 250_000)], itemById)
  const r = calculateYearEnd({ taxYear: 2025, totalSalary: t.totalSalary, insurancePremium: t.insurancePremium, pensionPremium: t.nationalPension, prepaidTax: t.incomeTax, personal: null })
  assert.deepEqual([r.taxBase, r.determinedTax, r.refund], [70_000, 1_890, 98_110])
  assert.deepEqual(r.warnings, ['연말정산 입력 자료가 없어 본인 기본공제만 적용했습니다.'])
})

test('급여가 없으면 모두 0, 과세 지급 항목이 여러 개면 모두 총급여에 합산', () => {
  assert.deepEqual(yearEndPayrollTotals([], itemById), {
    payrollCount: 0, totalSalary: 0, nonTaxableEarnings: 0, healthInsurance: 0, longTermCare: 0, employmentInsurance: 0,
    nationalPension: 0, incomeTax: 0, mealOverLimitMonths: [], insurancePremium: 0,
  })
  // 기본급 + 연장근로수당 + 상여금 + 기타수당 (과세), 식대 (비과세)
  const t = yearEndPayrollTotals([{ month: 7, lines: [line(1, 100), line(2, 20), line(3, 3), line(5, 4), line(4, 50)] }], itemById)
  assert.deepEqual([t.totalSalary, t.nonTaxableEarnings], [127, 50])
})
