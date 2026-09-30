// 체험 모드 급여 API 테스트 (실행: npm test) — 화면이 쓰는 것과 같은 경로로 가짜 서버를 부른다 (시뮬레이션 금액)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '../errors.js'
import { handleDemoRequest } from '../router.js'
import { createSeedData } from '../seed.js'
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

const line = (payItemId, amount) => ({ payItemId, amount })
// 가상사(id 4) 급여: 지급 3,400,000 (기본급 3,200,000 + 식대 200,000), 공제 400,000
// 초기 데이터: 급여 기간 9개(9월 작성 중 id 1 + 1~8월 확정 id 2~9), 급여 65건 → 새 기간 id 10, 새 급여 id 66
const NEXT_PERIOD_ID = 10
const NEXT_PAYROLL_ID = 66
const SEED_MONTHS = ['2026-9', '2026-8', '2026-7', '2026-6', '2026-5', '2026-4', '2026-3', '2026-2', '2026-1']
const NEW_LINES = [line(1, 3_200_000), line(4, 200_000), line(6, 150_000), line(8, 144_000), line(9, 106_000), line(2, 0)]

test('급여 항목: 12개, 표시 순서, 백엔드 응답 형식(id·code·name·category·taxType·sortOrder)', () => {
  const { call } = setup()
  const items = call('/api/pay-items')
  assert.equal(items.length, 12)
  assert.deepEqual(Object.keys(items[0]), ['id', 'code', 'name', 'category', 'taxType', 'sortOrder'])
  assert.deepEqual(items.map((i) => i.sortOrder), [...items.map((i) => i.sortOrder)].sort((a, b) => a - b))
})

test('기간 목록·상세: 초기 2026년 9월(작성 중), 급여 3건, 합계는 항목 금액으로 계산, 사원별 급여는 사번 순', () => {
  const { call } = setup()
  const [period] = call('/api/payroll-periods')
  assert.deepEqual(period, {
    id: 1, year: 2026, month: 9, paymentDate: '2026-09-25', status: 'DRAFT', confirmedAt: null,
    payrollCount: 3, totalEarnings: 3_200_000 + 3_800_000 + 2_900_000, totalDeductions: 370_000 + 460_000 + 319_000, totalNetPay: 2_830_000 + 3_340_000 + 2_581_000,
  })
  const detail = call('/api/payroll-periods/1')
  assert.deepEqual(detail.payrolls.map((p) => [p.employeeNo, p.totalEarnings, p.totalDeductions, p.netPay]), [
    ['DEMO001', 3_200_000, 370_000, 2_830_000],
    ['DEMO002', 3_800_000, 460_000, 3_340_000],
    ['DEMO003', 2_900_000, 319_000, 2_581_000],
  ])
  expectError(() => call('/api/payroll-periods/99'), 404, { message: '급여 기간을 찾을 수 없습니다.' })
  expectError(() => call('/api/payroll-periods/abc'), 400, { fieldErrors: { id: '형식이 올바르지 않습니다.' } })
})

test('기간 생성: 작성 중·급여 0건, 목록은 최신 연월부터, 같은 연월은 409, 입력 오류는 항목별 400', () => {
  const { call } = setup()
  const created = call('/api/payroll-periods', { method: 'POST', body: { year: 2026, month: 10, paymentDate: '2026-10-23' } })
  assert.deepEqual(created, { id: NEXT_PERIOD_ID, year: 2026, month: 10, paymentDate: '2026-10-23', status: 'DRAFT', confirmedAt: null, payrollCount: 0, totalEarnings: 0, totalDeductions: 0, totalNetPay: 0 })
  call('/api/payroll-periods', { method: 'POST', body: { year: 2025, month: 12, paymentDate: '2026-01-10' } })
  assert.deepEqual(call('/api/payroll-periods').map((p) => `${p.year}-${p.month}`), ['2026-10', ...SEED_MONTHS, '2025-12'])
  expectError(() => call('/api/payroll-periods', { method: 'POST', body: { year: 2026, month: 9, paymentDate: '2026-09-25' } }), 409, { message: '같은 연월의 급여 기간이 이미 있습니다.', fieldErrors: {} })
  expectError(() => call('/api/payroll-periods', { method: 'POST', body: { year: 1999, month: 13, paymentDate: null } }), 400, {
    fieldErrors: { year: '연도는 2000~2100 사이로 입력해 주세요.', month: '월은 1~12 사이로 입력해 주세요.', paymentDate: '지급일을 입력해 주세요.' },
  })
  expectError(() => call('/api/payroll-periods', { method: 'POST', body: { month: 1, paymentDate: '2026-01-10' } }), 400, { fieldErrors: { year: '연도를 입력해 주세요.' } })
  expectError(() => call('/api/payroll-periods', { method: 'POST', body: { year: 2027, month: 2, paymentDate: '2027-02-30' } }), 400, { fieldErrors: {} })
})

test('입력 가능한 사원: 해당 월 재직 + 아직 급여 없음 + 삭제 안 됨, 사번 순', () => {
  const { call } = setup()
  // 2026년 9월: DEMO001~003 은 이미 급여 있음, DEMO006 은 2026-06-30 퇴사 → 제외
  assert.deepEqual(call('/api/payroll-periods/1/eligible-employees').map((e) => e.employeeNo), ['DEMO004', 'DEMO005', 'DEMO007', 'DEMO008'])
  assert.deepEqual(Object.keys(call('/api/payroll-periods/1/eligible-employees')[0]), ['id', 'employeeNo', 'name', 'department', 'position', 'employmentStatus'])
  // 2025년 8월 기간: DEMO005(2025-02 입사) 포함, DEMO008(2025-08-01 입사) 포함, DEMO003(2024) 포함, 퇴사자 DEMO006(2026-06 퇴사) 포함
  call('/api/payroll-periods', { method: 'POST', body: { year: 2025, month: 7, paymentDate: '2025-07-25' } })
  assert.deepEqual(call(`/api/payroll-periods/${NEXT_PERIOD_ID}/eligible-employees`).map((e) => e.employeeNo), ['DEMO001', 'DEMO002', 'DEMO003', 'DEMO004', 'DEMO005', 'DEMO006', 'DEMO007'])
  call('/api/employees/7', { method: 'DELETE' })
  assert.ok(!call('/api/payroll-periods/1/eligible-employees').some((e) => e.employeeNo === 'DEMO007'))
})

test('급여 입력: 명세서 형식, 0원 항목은 저장 안 함, 항목 표시 순서, 입력 당시 사원 정보 복사, 메모 공백 정리', () => {
  const { call, store } = setup()
  const detail = call('/api/payroll-periods/1/payrolls', { method: 'POST', body: { employeeId: 4, lines: NEW_LINES, memo: '  9월 급여  ' } })
  assert.equal(detail.id, NEXT_PAYROLL_ID)
  assert.deepEqual(detail.period, { id: 1, year: 2026, month: 9, paymentDate: '2026-09-25', status: 'DRAFT' })
  assert.deepEqual([detail.employeeNo, detail.employeeName, detail.department, detail.position], ['DEMO004', '가상사', '개발팀', '대리'])
  assert.deepEqual(detail.earnings, [
    { payItemId: 1, itemName: '기본급', taxType: 'TAXABLE', amount: 3_200_000 },
    { payItemId: 4, itemName: '식대', taxType: 'NON_TAXABLE', amount: 200_000 },
  ])
  assert.deepEqual(detail.deductions.map((d) => d.itemName), ['소득세', '국민연금', '건강보험'])
  assert.deepEqual([detail.totalEarnings, detail.totalDeductions, detail.netPay, detail.memo], [3_400_000, 400_000, 3_000_000, '9월 급여'])
  assert.ok(!store.getState().payrolls.find((p) => p.id === NEXT_PAYROLL_ID).lines.some((l) => l.payItemId === 2), '0원 항목은 저장하지 않음')
  // 사원 정보를 바꿔도 이미 입력한 급여의 사원 정보는 그대로 (입력 당시 값)
  call('/api/employees/4', { method: 'PUT', body: { name: '가상사(개명)', hireDate: '2022-09-01', department: '영업팀', position: '과장', employmentStatus: 'ACTIVE' } })
  assert.deepEqual([call(`/api/payrolls/${NEXT_PAYROLL_ID}`).employeeName, call(`/api/payrolls/${NEXT_PAYROLL_ID}`).department], ['가상사', '개발팀'])
  assert.equal(call('/api/payroll-periods/1').payrollCount, 4)
})

test('급여 입력 오류: 본문 검사 → 기간 404 → 사원 404 → 삭제·재직 아님 400 → 중복 409 → 항목 규칙 400 (서버와 같은 문구)', () => {
  const { call } = setup()
  expectError(() => call('/api/payroll-periods/1/payrolls', { method: 'POST', body: { lines: [] } }), 400, { fieldErrors: { employeeId: '사원을 선택해 주세요.', lines: '급여 항목을 입력해 주세요.' } })
  expectError(() => call('/api/payroll-periods/1/payrolls', { method: 'POST', body: { employeeId: 4, lines: [line(1, -1), line(null, 5), line(4, 1_000_000_001)], memo: 'x'.repeat(201) } }), 400, {
    fieldErrors: { 'lines[0].amount': '금액은 0원 이상으로 입력해 주세요.', 'lines[1].payItemId': '항목을 선택해 주세요.', 'lines[2].amount': '항목 금액은 1,000,000,000원 이하로 입력해 주세요.', memo: '메모는 200자 이하로 입력해 주세요.' },
  })
  expectError(() => call('/api/payroll-periods/99/payrolls', { method: 'POST', body: { employeeId: 4, lines: NEW_LINES } }), 404, { message: '급여 기간을 찾을 수 없습니다.' })
  expectError(() => call('/api/payroll-periods/1/payrolls', { method: 'POST', body: { employeeId: 99, lines: NEW_LINES } }), 404, { message: '사원 정보를 찾을 수 없습니다.' })
  expectError(() => call('/api/payroll-periods/1/payrolls', { method: 'POST', body: { employeeId: 6, lines: NEW_LINES } }), 400, { message: '해당 월에 재직한 사원만 급여를 입력할 수 있습니다.', fieldErrors: {} })
  call('/api/employees/5', { method: 'DELETE' })
  expectError(() => call('/api/payroll-periods/1/payrolls', { method: 'POST', body: { employeeId: 5, lines: NEW_LINES } }), 400, { message: '삭제된 사원에게는 급여를 입력할 수 없습니다.' })
  expectError(() => call('/api/payroll-periods/1/payrolls', { method: 'POST', body: { employeeId: 1, lines: NEW_LINES } }), 409, { message: '이 기간에 이미 급여가 입력된 사원입니다.' })
  const lines = (ls) => ({ method: 'POST', body: { employeeId: 4, lines: ls } })
  expectError(() => call('/api/payroll-periods/1/payrolls', lines([line(99, 1)])), 400, { message: '입력값을 확인해 주세요.', fieldErrors: { lines: '존재하지 않는 항목입니다: 99' } })
  expectError(() => call('/api/payroll-periods/1/payrolls', lines([line(1, 100), line(1, 200)])), 400, { fieldErrors: { lines: '같은 항목을 두 번 입력할 수 없습니다: 기본급' } })
  expectError(() => call('/api/payroll-periods/1/payrolls', lines([line(1, 0), line(6, 0)])), 400, { fieldErrors: { lines: '지급 항목을 1개 이상 입력해 주세요.' } })
  expectError(() => call('/api/payroll-periods/1/payrolls', lines([line(1, 100), line(6, 101)])), 400, { fieldErrors: { lines: '공제 합계가 지급 합계보다 클 수 없습니다. 실지급액은 0원 이상이어야 합니다.' } })
})

test('급여 수정·삭제: 작성 중에만, 수정은 항목 전체와 메모, 삭제는 실제 삭제(204)', () => {
  const { call, store } = setup()
  const updated = call('/api/payrolls/1', { method: 'PUT', body: { lines: [line(1, 3_100_000), line(6, 90_000)], memo: null, employeeId: 999 } })
  assert.deepEqual([updated.employeeId, updated.totalEarnings, updated.totalDeductions, updated.netPay, updated.memo], [1, 3_100_000, 90_000, 3_010_000, null])
  assert.deepEqual(updated.earnings.map((e) => e.itemName), ['기본급'])
  expectError(() => call('/api/payrolls/99'), 404, { message: '급여 정보를 찾을 수 없습니다.' })
  assert.equal(call('/api/payrolls/3', { method: 'DELETE' }), null)
  assert.ok(!store.getState().payrolls.some((p) => p.id === 3), '실제 삭제')
  expectError(() => call('/api/payrolls/3'), 404)
  assert.ok(call('/api/payroll-periods/1/eligible-employees').some((e) => e.employeeNo === 'DEMO003'), '삭제 후 다시 입력 가능')
})

test('확정·확정 취소: 확정 시각 기록, 확정된 기간은 지급일·급여 입력·수정·삭제가 409, 상태 오류 문구', () => {
  const { call } = setup()
  const confirmed = call('/api/payroll-periods/1/confirm', { method: 'POST' })
  assert.equal(confirmed.status, 'CONFIRMED')
  assert.match(confirmed.confirmedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}$/)
  const locked = { message: '확정된 급여 기간은 변경할 수 없습니다. 확정을 취소한 뒤 수정해 주세요.' }
  expectError(() => call('/api/payroll-periods/1', { method: 'PUT', body: { paymentDate: '2026-09-24' } }), 409, locked)
  expectError(() => call('/api/payroll-periods/1/payrolls', { method: 'POST', body: { employeeId: 4, lines: NEW_LINES } }), 409, locked)
  expectError(() => call('/api/payrolls/1', { method: 'PUT', body: { lines: [line(1, 1)] } }), 409, locked)
  expectError(() => call('/api/payrolls/1', { method: 'DELETE' }), 409, locked)
  expectError(() => call('/api/payroll-periods/1/confirm', { method: 'POST' }), 409, { message: '이미 확정된 급여 기간입니다.' })
  const reopened = call('/api/payroll-periods/1/reopen', { method: 'POST' })
  assert.deepEqual([reopened.status, reopened.confirmedAt], ['DRAFT', null])
  expectError(() => call('/api/payroll-periods/1/reopen', { method: 'POST' }), 409, { message: '확정되지 않은 급여 기간입니다.' })
  assert.equal(call('/api/payroll-periods/1', { method: 'PUT', body: { paymentDate: '2026-09-24' } }).paymentDate, '2026-09-24')
  expectError(() => call('/api/payroll-periods/1', { method: 'PUT', body: {} }), 400, { fieldErrors: { paymentDate: '지급일을 입력해 주세요.' } })
  call('/api/payroll-periods', { method: 'POST', body: { year: 2026, month: 10, paymentDate: '2026-10-23' } })
  expectError(() => call(`/api/payroll-periods/${NEXT_PERIOD_ID}/confirm`, { method: 'POST' }), 409, { message: '급여 내역이 1건 이상 있어야 확정할 수 있습니다.' })
})

test('새로고침 후 유지 + 초기화 후 seed 복구 (기간·급여)', () => {
  const { storage, store, call } = setup()
  call('/api/payroll-periods', { method: 'POST', body: { year: 2026, month: 10, paymentDate: '2026-10-23' } })
  call('/api/payroll-periods/1/payrolls', { method: 'POST', body: { employeeId: 4, lines: NEW_LINES } })
  call('/api/payrolls/2', { method: 'PUT', body: { lines: [line(1, 3_700_000)], memo: '수정' } })
  call('/api/payroll-periods/1/confirm', { method: 'POST' })
  const reloaded = createDemoStore({ storage })
  const again = (path) => handleDemoRequest(reloaded, path)
  assert.equal(again('/api/payroll-periods').length, SEED_MONTHS.length + 1)
  assert.equal(again('/api/payroll-periods/1').status, 'CONFIRMED')
  assert.equal(again('/api/payroll-periods/1').payrollCount, 4)
  assert.deepEqual([again('/api/payrolls/2').totalEarnings, again('/api/payrolls/2').memo], [3_700_000, '수정'])
  store.reset()
  assert.deepEqual(store.getState(), createSeedData())
  assert.equal(call('/api/payroll-periods').length, SEED_MONTHS.length)
  assert.equal(call('/api/payroll-periods/1').status, 'DRAFT')
})

test('초기 확정 기간(2026년 1~8월): 목록 합계, 지급일·급여 입력·수정·삭제는 409, 확정 취소하면 수정 가능', () => {
  const { call } = setup()
  const periods = call('/api/payroll-periods')
  assert.deepEqual(periods.map((p) => `${p.year}-${p.month}`), SEED_MONTHS)
  assert.deepEqual(periods.filter((p) => p.status === 'CONFIRMED').map((p) => p.id), [9, 8, 7, 6, 5, 4, 3, 2])
  const byMonth = Object.fromEntries(periods.map((p) => [p.month, p]))
  // 1~6월은 8명, 퇴사자(DEMO006, 6월 말 퇴사)가 빠진 7·8월은 7명
  assert.deepEqual(periods.map((p) => p.payrollCount), [3, 7, 7, 8, 8, 8, 8, 8, 8])
  // 1월: 기본급 합계 24,400,000 + 식대 8명 × 200,000
  assert.equal(byMonth[1].totalEarnings, 24_400_000 + 1_600_000)
  // 7월: 상여금(기본급의 50%) 포함 — 퇴사자 제외 기본급 합계 20,400,000 × 1.5 + 식대 7명
  assert.equal(byMonth[7].totalEarnings, 30_600_000 + 1_400_000)
  assert.equal(byMonth[7].confirmedAt, '2026-07-24T17:00:00.000')
  const locked = { message: '확정된 급여 기간은 변경할 수 없습니다. 확정을 취소한 뒤 수정해 주세요.' }
  const [first] = call('/api/payroll-periods/2').payrolls
  expectError(() => call('/api/payroll-periods/2', { method: 'PUT', body: { paymentDate: '2026-01-26' } }), 409, locked)
  expectError(() => call(`/api/payrolls/${first.id}`, { method: 'PUT', body: { lines: [line(1, 1)] } }), 409, locked)
  expectError(() => call(`/api/payrolls/${first.id}`, { method: 'DELETE' }), 409, locked)
  call('/api/payroll-periods/2/reopen', { method: 'POST' })
  assert.equal(call(`/api/payrolls/${first.id}`, { method: 'PUT', body: { lines: [line(1, 3_000_000)] } }).totalEarnings, 3_000_000)
})

test('지원하지 않는 방식 405, 없는 경로 404', () => {
  const { call } = setup()
  expectError(() => call('/api/pay-items', { method: 'POST' }), 405)
  expectError(() => call('/api/payroll-periods/1/confirm'), 405)
  expectError(() => call('/api/payrolls', { method: 'GET' }), 404)
  expectError(() => call('/api/payroll-periods/1/unknown'), 404)
  expectError(() => call('/api/constructor'), 501)
})
