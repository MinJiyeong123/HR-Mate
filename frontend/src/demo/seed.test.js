// 체험 모드 초기 가상 데이터 테스트 (실행: npm test)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSeedData, PAY_ITEMS, SCHEMA_VERSION } from './seed.js'
import { isValidState } from './storage.js'

test('초기 데이터: 가상 사원 8명(재직 7, 퇴사 1), 작성 중 급여 기간 1개, 급여 3건', () => {
  const seed = createSeedData()
  assert.equal(seed.schemaVersion, SCHEMA_VERSION)
  assert.equal(seed.employees.length, 8)
  assert.equal(seed.employees.filter((e) => e.employmentStatus === 'RESIGNED').length, 1)
  assert.deepEqual(seed.payrollPeriods.map((p) => [p.year, p.month, p.status]), [[2026, 9, 'DRAFT']])
  assert.equal(seed.payrolls.length, 3)
  assert.deepEqual(seed.yearEndInputs, [])
  assert.ok(isValidState(seed))
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
