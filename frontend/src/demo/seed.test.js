// 체험 모드 초기 가상 데이터 테스트 (실행: npm test)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSeedData, PAY_ITEMS, SCHEMA_VERSION } from './seed.js'
import { isValidState } from './storage.js'
import { INPUT_FIELDS, validateYearEndInput } from '../utils/yearEndValidation.js'

const MAN = 10_000
const codeOf = (payItemId) => PAY_ITEMS.find((i) => i.id === payItemId).code
const sumCode = (payrolls, code) => payrolls.flatMap((p) => p.lines).filter((l) => codeOf(l.payItemId) === code).reduce((s, l) => s + l.amount, 0)

test('초기 데이터: 가상 사원 8명(재직 7, 퇴사 1), 급여 기간 9개(9월 작성 중 + 1~8월 확정), 급여 65건, 연말정산 입력 1건', () => {
  const seed = createSeedData()
  assert.equal(seed.schemaVersion, SCHEMA_VERSION)
  assert.equal(seed.employees.length, 8)
  assert.equal(seed.employees.filter((e) => e.employmentStatus === 'RESIGNED').length, 1)
  assert.deepEqual(seed.payrollPeriods.map((p) => [p.id, p.year, p.month, p.status]), [
    [1, 2026, 9, 'DRAFT'],
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((month) => [month + 1, 2026, month, 'CONFIRMED']),
  ])
  // D1 부터 있던 9월 급여 3건(id 1~3)은 그대로
  assert.deepEqual(seed.payrolls.filter((p) => p.periodId === 1).map((p) => [p.id, p.employeeNo]), [[1, 'DEMO001'], [2, 'DEMO002'], [3, 'DEMO003']])
  assert.equal(seed.payrolls.length, 3 + 62)
  assert.deepEqual(seed.nextIds, { employee: 9, payrollPeriod: 10, payroll: 66 })
  assert.equal(seed.yearEndInputs.length, 1)
  assert.ok(isValidState(seed))
})

test('확정 기간: 지급일 25일, 확정 시각 있음 / 작성 중 기간: 확정 시각 없음', () => {
  for (const p of createSeedData().payrollPeriods) {
    assert.equal(p.paymentDate, `2026-${String(p.month).padStart(2, '0')}-25`)
    if (p.status === 'CONFIRMED') assert.equal(p.confirmedAt, `2026-${String(p.month).padStart(2, '0')}-24T17:00:00.000`)
    else assert.equal(p.confirmedAt, null)
  }
})

test('확정 급여: 사원·기간 조합이 겹치지 않고, 그 달에 재직한 사원만 (퇴사자 DEMO006 은 1~6월만)', () => {
  const seed = createSeedData()
  const confirmedIds = new Set(seed.payrollPeriods.filter((p) => p.status === 'CONFIRMED').map((p) => p.id))
  const confirmed = seed.payrolls.filter((p) => confirmedIds.has(p.periodId))
  const keys = confirmed.map((p) => `${p.periodId}-${p.employeeId}`)
  assert.equal(new Set(keys).size, keys.length)
  const monthsOf = (employeeId) => confirmed.filter((p) => p.employeeId === employeeId).map((p) => seed.payrollPeriods.find((x) => x.id === p.periodId).month)
  assert.deepEqual(monthsOf(6), [1, 2, 3, 4, 5, 6])
  for (const id of [1, 2, 3, 4, 5, 7, 8]) assert.deepEqual(monthsOf(id), [1, 2, 3, 4, 5, 6, 7, 8])
})

test('확정 급여 연간 합계(시뮬레이션 값): 7월 상여금, 식대 월 20만원, 지방소득세 = 소득세의 10%', () => {
  const seed = createSeedData()
  const confirmedIds = new Set(seed.payrollPeriods.filter((p) => p.status === 'CONFIRMED').map((p) => p.id))
  const of = (employeeId) => seed.payrolls.filter((p) => confirmedIds.has(p.periodId) && p.employeeId === employeeId)
  // DEMO001: 기본급 300만원 × 8 + 7월 상여금 150만원, 소득세 10만원 × 8 + 7월 추가 12만원
  assert.equal(sumCode(of(1), 'BASE_SALARY'), 2_400 * MAN)
  assert.equal(sumCode(of(1), 'BONUS'), 150 * MAN)
  assert.equal(sumCode(of(1), 'MEAL_ALLOWANCE'), 160 * MAN)
  assert.equal(sumCode(of(1), 'INCOME_TAX'), 92 * MAN)
  assert.equal(sumCode(of(1), 'LOCAL_INCOME_TAX'), 9.2 * MAN)
  // DEMO006(퇴사자): 1~6월, 상여금 없음
  assert.equal(sumCode(of(6), 'BASE_SALARY'), 2_400 * MAN)
  assert.equal(sumCode(of(6), 'BONUS'), 0)
  // 전체 확정 급여: 1~6월 8명, 7·8월 7명, 식대는 모두 월 20만원
  const all = seed.payrolls.filter((p) => confirmedIds.has(p.periodId))
  assert.equal(all.length, 62)
  assert.equal(sumCode(all, 'MEAL_ALLOWANCE'), 62 * 20 * MAN)
  for (const p of all) {
    const tax = sumCode([p], 'INCOME_TAX')
    assert.equal(sumCode([p], 'LOCAL_INCOME_TAX'), tax / 10)
    assert.equal(sumCode([p], 'MEAL_ALLOWANCE'), 20 * MAN, '식대 비과세 한도(월 20만원) 이내')
  }
})

test('연말정산 입력 자료 예시: DEMO002 2026년 귀속, 입력 항목 10개 + 화면 검증 규칙 통과', () => {
  const [input] = createSeedData().yearEndInputs
  assert.deepEqual(Object.keys(input), ['employeeId', 'taxYear', ...INPUT_FIELDS, 'updatedAt'])
  assert.deepEqual([input.employeeId, input.taxYear, input.spouseDeduction, input.dependentCount, input.childCreditCount], [2, 2026, true, 1, 1])
  assert.deepEqual(validateYearEndInput(input), {})
})

test('초기 데이터: 실제 개인정보 형태가 없음 (DEMO 사번, 가상 이름, 전화·이메일 없음, 메모 없음)', () => {
  const seed = createSeedData()
  for (const e of seed.employees) {
    assert.match(e.employeeNo, /^DEMO\d{3}$/)
    assert.match(e.name, /^가상/)
    assert.equal(e.phone, null)
    assert.equal(e.email, null)
    assert.equal(e.deletedAt, null)
  }
  for (const p of seed.payrolls) assert.equal(p.memo, null)
})

test('초기 데이터: id 는 겹치지 않고 다음 id 는 가장 큰 id 보다 큼', () => {
  const seed = createSeedData()
  const check = (list, next) => {
    const ids = list.map((x) => x.id)
    assert.equal(new Set(ids).size, ids.length)
    assert.ok(next > Math.max(...ids))
  }
  check(seed.employees, seed.nextIds.employee)
  check(seed.payrollPeriods, seed.nextIds.payrollPeriod)
  check(seed.payrolls, seed.nextIds.payroll)
})

test('초기 급여: 기간·사원·급여 항목을 올바르게 가리키고, 사원 정보가 복사되어 있음', () => {
  const seed = createSeedData()
  const itemIds = new Set(PAY_ITEMS.map((i) => i.id))
  for (const p of seed.payrolls) {
    assert.ok(seed.payrollPeriods.some((period) => period.id === p.periodId))
    const emp = seed.employees.find((e) => e.id === p.employeeId)
    assert.ok(emp)
    assert.equal(p.employeeNo, emp.employeeNo)
    assert.equal(p.employeeName, emp.name)
    assert.ok(p.lines.length > 0)
    for (const line of p.lines) {
      assert.ok(itemIds.has(line.payItemId))
      assert.ok(Number.isInteger(line.amount) && line.amount > 0)
    }
    // 백엔드 규칙과 같게: 공제 합계 ≤ 지급 합계
    const sum = (category) => p.lines.filter((l) => PAY_ITEMS.find((i) => i.id === l.payItemId).category === category).reduce((s, l) => s + l.amount, 0)
    assert.ok(sum('DEDUCTION') <= sum('EARNING'))
  }
})

test('급여 항목 12개: 백엔드 V2 시드와 같은 코드·순서', () => {
  assert.deepEqual(PAY_ITEMS.map((i) => i.code), [
    'BASE_SALARY', 'OVERTIME_PAY', 'BONUS', 'MEAL_ALLOWANCE', 'OTHER_ALLOWANCE',
    'INCOME_TAX', 'LOCAL_INCOME_TAX', 'NATIONAL_PENSION', 'HEALTH_INSURANCE', 'LONG_TERM_CARE', 'EMPLOYMENT_INSURANCE', 'OTHER_DEDUCTION',
  ])
  assert.deepEqual(PAY_ITEMS.map((i) => i.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
})

test('createSeedData 는 매번 새 복사본을 돌려줌 (한쪽을 바꿔도 다른 쪽은 그대로)', () => {
  const a = createSeedData()
  const b = createSeedData()
  a.employees[0].name = '바뀜'
  a.payrolls[0].lines[0].amount = 1
  assert.equal(b.employees[0].name, '가상일')
  assert.equal(b.payrolls[0].lines[0].amount, 3_000_000)
  assert.equal(createSeedData().employees[0].name, '가상일')
})
