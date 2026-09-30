// 체험 모드 연간 급여 집계 API 테스트 (실행: npm test) — 화면이 쓰는 것과 같은 경로로 가짜 서버를 부른다 (시뮬레이션 금액)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '../errors.js'
import { handleDemoRequest } from '../router.js'
import { createDemoStore } from '../storage.js'

function fakeStorage() {
  const data = new Map()
  return { data, getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k) }
}

function setup() {
  const storage = fakeStorage()
  const store = createDemoStore({ storage })
  return { storage, store, call: (path, options) => handleDemoRequest(store, path, options) }
}

function expectError(fn, status, { message, fieldErrors } = {}) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof ApiError, `ApiError 가 아님: ${error}`)
    assert.equal(error.status, status, `status ${error.status} message ${error.message}`)
    if (message !== undefined) assert.equal(error.message, message)
    if (fieldErrors !== undefined) assert.deepEqual(error.fieldErrors, fieldErrors)
    return true
  })
}

const MAN = 10_000
const totals = (taxable, nonTaxable, deductions) => ({
  totalEarnings: taxable + nonTaxable, taxableEarnings: taxable, nonTaxableEarnings: nonTaxable, totalDeductions: deductions, netPay: taxable + nonTaxable - deductions,
})
// 초기 데이터 기준 기대값 (확정된 2026년 1~8월만)
// DEMO001: 기본급 300만 × 8 + 7월 상여금 150만 / 식대 20만 × 8 / 공제 월 37만 × 7 + 7월 50.2만(소득세 22만·지방소득세 2.2만)
const DEMO001 = totals(2_550 * MAN, 160 * MAN, 370_000 * 7 + 502_000)
// DEMO006(6월 말 퇴사): 기본급 400만 × 6, 상여금 없음 / 공제 월 651,160 × 6
const DEMO006 = totals(2_400 * MAN, 120 * MAN, 651_160 * 6)
// 회사 전체: 과세 = (퇴사자 외 기본급 합계 2,040만 × 8 + 상여금 1,020만) + 퇴사자 2,400만, 비과세 = 급여 62건 × 식대 20만
const COMPANY = totals(19_740 * MAN, 1_240 * MAN, 23_351_560)

test('연간 집계 2026: 확정 기간 8개만 합산, 9월 작성 중 1개는 제외, 사원 8명 사번 순, 사원 합계의 합 = 전체 합계', () => {
  const { call } = setup()
  const summary = call('/api/payroll-summaries/annual?year=2026')
  assert.deepEqual(Object.keys(summary), ['year', 'confirmedPeriodCount', 'excludedDraftPeriodCount', 'totals', 'employees'])
  assert.deepEqual([summary.year, summary.confirmedPeriodCount, summary.excludedDraftPeriodCount], [2026, 8, 1])
  assert.deepEqual(summary.employees.map((e) => [e.employeeNo, e.payrollCount]), [
    ['DEMO001', 8], ['DEMO002', 8], ['DEMO003', 8], ['DEMO004', 8], ['DEMO005', 8], ['DEMO006', 6], ['DEMO007', 8], ['DEMO008', 8],
  ])
  const first = summary.employees[0]
  assert.deepEqual(first, { employeeId: 1, employeeNo: 'DEMO001', employeeName: '가상일', department: '인사팀', position: '대리', deleted: false, payrollCount: 8, totals: DEMO001 })
  assert.deepEqual(summary.employees[5].totals, DEMO006)
  assert.deepEqual(summary.totals, COMPANY)
  const sum = (key) => summary.employees.reduce((s, e) => s + e.totals[key], 0)
  for (const key of Object.keys(COMPANY)) assert.equal(sum(key), summary.totals[key], key)
})

test('사원별 연간 상세 DEMO001: 1~8월 월별 행, 7월 상여금, 9월 작성 중 급여 1건은 제외, 항목별 합계는 표시 순서', () => {
  const { call } = setup()
  const detail = call('/api/payroll-summaries/annual/employees/1?year=2026')
  assert.deepEqual(Object.keys(detail), ['year', 'employeeId', 'employeeNo', 'employeeName', 'department', 'position', 'deleted', 'excludedDraftPayrollCount', 'totals', 'months', 'items'])
  assert.deepEqual([detail.employeeNo, detail.employeeName, detail.deleted, detail.excludedDraftPayrollCount], ['DEMO001', '가상일', false, 1])
  assert.deepEqual(detail.months.map((m) => m.month), [1, 2, 3, 4, 5, 6, 7, 8])
  assert.deepEqual(detail.months[0], { payrollId: 4, month: 1, paymentDate: '2026-01-25', totalEarnings: 3_200_000, taxableEarnings: 3_000_000, nonTaxableEarnings: 200_000, totalDeductions: 370_000, netPay: 2_830_000 })
  assert.deepEqual(detail.months[6], { payrollId: detail.months[6].payrollId, month: 7, paymentDate: '2026-07-25', totalEarnings: 4_700_000, taxableEarnings: 4_500_000, nonTaxableEarnings: 200_000, totalDeductions: 502_000, netPay: 4_198_000 })
  assert.deepEqual(detail.totals, DEMO001)
  assert.deepEqual(detail.items.map((i) => [i.itemName, i.amount]), [
    ['기본급', 2_400 * MAN], ['상여금', 150 * MAN], ['식대', 160 * MAN],
    ['소득세', 92 * MAN], ['지방소득세', 92_000], ['국민연금', 108 * MAN], ['건강보험', 80 * MAN], ['장기요양보험', 40_000], ['고용보험', 160_000],
  ])
  assert.deepEqual(detail.items[2], { payItemId: 4, itemName: '식대', category: 'EARNING', taxType: 'NON_TAXABLE', amount: 160 * MAN })
  // 월별 합계의 합 = 연간 합계 = 연간 집계의 사원 줄
  assert.equal(detail.months.reduce((s, m) => s + m.netPay, 0), detail.totals.netPay)
  assert.deepEqual(call('/api/payroll-summaries/annual?year=2026').employees[0].totals, detail.totals)
})

test('퇴사자 DEMO006: 1~6월 급여가 집계에 포함, 작성 중 제외 0건 / DEMO004: 9월 급여 없음 → 제외 0건', () => {
  const { call } = setup()
  const resigned = call('/api/payroll-summaries/annual/employees/6?year=2026')
  assert.deepEqual(resigned.months.map((m) => m.month), [1, 2, 3, 4, 5, 6])
  assert.deepEqual([resigned.excludedDraftPayrollCount, resigned.totals], [0, DEMO006])
  assert.ok(!resigned.items.some((i) => i.itemName === '상여금'))
  assert.equal(call('/api/payroll-summaries/annual/employees/4?year=2026').excludedDraftPayrollCount, 0)
})

test('확정 급여가 없는 연도(2025): 오류가 아니라 합계 0과 빈 목록, 사원 상세는 현재 사원 정보', () => {
  const { call } = setup()
  assert.deepEqual(call('/api/payroll-summaries/annual?year=2025'), { year: 2025, confirmedPeriodCount: 0, excludedDraftPeriodCount: 0, totals: totals(0, 0, 0), employees: [] })
  assert.deepEqual(call('/api/payroll-summaries/annual/employees/2?year=2025'), {
    year: 2025, employeeId: 2, employeeNo: 'DEMO002', employeeName: '가상이', department: '재무팀', position: '과장', deleted: false,
    excludedDraftPayrollCount: 0, totals: totals(0, 0, 0), months: [], items: [],
  })
})

test('확정·확정 취소가 집계에 바로 반영: 9월 확정 → 포함, 1월 확정 취소 → 제외', () => {
  const { call } = setup()
  call('/api/payroll-periods/1/confirm', { method: 'POST' })
  let summary = call('/api/payroll-summaries/annual?year=2026')
  assert.deepEqual([summary.confirmedPeriodCount, summary.excludedDraftPeriodCount, summary.employees[0].payrollCount], [9, 0, 9])
  assert.equal(summary.employees[0].totals.taxableEarnings, DEMO001.taxableEarnings + 3_000_000)
  call('/api/payroll-periods/2/reopen', { method: 'POST' })
  summary = call('/api/payroll-summaries/annual?year=2026')
  assert.deepEqual([summary.confirmedPeriodCount, summary.excludedDraftPeriodCount, summary.employees[0].payrollCount], [8, 1, 8])
  assert.equal(call('/api/payroll-summaries/annual/employees/1?year=2026').months[0].month, 2)
})

test('사원 정보는 마지막 확정 급여의 값(스냅샷), 논리 삭제된 사원도 포함하고 deleted 표시', () => {
  const { call } = setup()
  call('/api/employees/1', { method: 'PUT', body: { name: '가상일(개명)', hireDate: '2021-03-02', department: '재무팀', position: '과장', employmentStatus: 'ACTIVE' } })
  call('/api/employees/7', { method: 'DELETE' })
  const summary = call('/api/payroll-summaries/annual?year=2026')
  assert.deepEqual([summary.employees[0].employeeName, summary.employees[0].department], ['가상일', '인사팀'])
  const deleted = summary.employees.find((e) => e.employeeNo === 'DEMO007')
  assert.deepEqual([deleted.deleted, deleted.payrollCount], [true, 8])
  assert.equal(call('/api/payroll-summaries/annual/employees/7?year=2026').deleted, true)
  // 확정 급여가 없는 연도는 현재(바뀐) 사원 정보
  assert.equal(call('/api/payroll-summaries/annual/employees/1?year=2025').employeeName, '가상일(개명)')
})

test('조회만 한다: 저장소(localStorage) 값이 바뀌지 않음', () => {
  const { call, storage } = setup()
  call('/api/employees')
  const before = [...storage.data.entries()]
  call('/api/payroll-summaries/annual?year=2026')
  call('/api/payroll-summaries/annual/employees/1?year=2026')
  assert.deepEqual([...storage.data.entries()], before)
})

test('오류: 연도 누락·형식·범위 400, 사원 id 형식 400, 없는 사원 404, 조회 외 방식 405, 없는 경로 404 (서버와 같은 문구)', () => {
  const { call } = setup()
  expectError(() => call('/api/payroll-summaries/annual'), 400, { message: '입력값을 확인해 주세요.', fieldErrors: { year: '값을 입력해 주세요.' } })
  expectError(() => call('/api/payroll-summaries/annual?year='), 400, { fieldErrors: { year: '값을 입력해 주세요.' } })
  expectError(() => call('/api/payroll-summaries/annual?year=abc'), 400, { fieldErrors: { year: '형식이 올바르지 않습니다.' } })
  expectError(() => call('/api/payroll-summaries/annual?year=1999'), 400, { fieldErrors: { year: '연도는 2000~2100 사이로 입력해 주세요.' } })
  expectError(() => call('/api/payroll-summaries/annual/employees/1?year=2101'), 400, { fieldErrors: { year: '연도는 2000~2100 사이로 입력해 주세요.' } })
  expectError(() => call('/api/payroll-summaries/annual/employees/abc?year=2026'), 400, { fieldErrors: { employeeId: '형식이 올바르지 않습니다.' } })
  expectError(() => call('/api/payroll-summaries/annual/employees/99?year=2026'), 404, { message: '사원 정보를 찾을 수 없습니다.' })
  expectError(() => call('/api/payroll-summaries/annual?year=2026', { method: 'POST' }), 405)
  expectError(() => call('/api/payroll-summaries'), 404)
  expectError(() => call('/api/payroll-summaries/annual/employees'), 404)
})
