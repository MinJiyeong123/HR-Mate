// 체험 모드 사원 API 테스트 (실행: npm test) — 화면이 쓰는 것과 같은 경로로 가짜 서버를 부른다
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '../errors.js'
import { handleDemoRequest } from '../router.js'
import { createSeedData } from '../seed.js'
import { createDemoStore, STORAGE_KEY } from '../storage.js'

function fakeStorage() {
  const data = new Map()
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  }
}

function setup() {
  const storage = fakeStorage()
  const store = createDemoStore({ storage })
  const call = (path, options) => handleDemoRequest(store, path, options)
  return { storage, store, call }
}

/** 오류를 던지는지와 status·message·fieldErrors 를 확인한다. */
function expectError(fn, status, { message, fieldErrors } = {}) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof ApiError, `ApiError 가 아님: ${error}`)
    assert.equal(error.status, status)
    if (message !== undefined) assert.equal(error.message, message)
    if (fieldErrors !== undefined) assert.deepEqual(error.fieldErrors, fieldErrors)
    return true
  })
}

const NEW_EMPLOYEE = {
  employeeNo: 'demo101',
  name: '  가상신입  ',
  hireDate: '2026-10-01',
  department: ' 개발팀 ',
  position: '',
  phone: null,
  email: 'demo101@example.com',
}

const RESPONSE_KEYS = ['id', 'employeeNo', 'name', 'department', 'position', 'phone', 'email', 'hireDate', 'employmentStatus', 'resignationDate']

test('목록: 초기 사원 8명, 사번 순, 응답에 내부 값(deletedAt) 없음', () => {
  const { call } = setup()
  const list = call('/api/employees')
  assert.equal(list.length, 8)
  assert.deepEqual(list.map((e) => e.employeeNo), ['DEMO001', 'DEMO002', 'DEMO003', 'DEMO004', 'DEMO005', 'DEMO006', 'DEMO007', 'DEMO008'])
  for (const e of list) assert.deepEqual(Object.keys(e), RESPONSE_KEYS)
})

test('상세: 있는 사원은 응답, 없는 id 는 404, 숫자가 아닌 id 는 400', () => {
  const { call } = setup()
  assert.equal(call('/api/employees/2').name, '가상이')
  expectError(() => call('/api/employees/999'), 404, { message: '사원 정보를 찾을 수 없습니다.', fieldErrors: {} })
  expectError(() => call('/api/employees/abc'), 400, { fieldErrors: { id: '형식이 올바르지 않습니다.' } })
})

test('등록: 201 응답 형태, 사번 대문자, 앞뒤 공백 정리, 빈 값은 null, 재직 상태, 새 id', () => {
  const { call } = setup()
  const created = call('/api/employees', { method: 'POST', body: NEW_EMPLOYEE })
  assert.deepEqual(created, {
    id: 9, employeeNo: 'DEMO101', name: '가상신입', department: '개발팀', position: null, phone: null,
    email: 'demo101@example.com', hireDate: '2026-10-01', employmentStatus: 'ACTIVE', resignationDate: null,
  })
  assert.equal(call('/api/employees').length, 9)
  assert.equal(call('/api/employees/9').employeeNo, 'DEMO101')
  // 다음 등록은 id 10
  assert.equal(call('/api/employees', { method: 'POST', body: { ...NEW_EMPLOYEE, employeeNo: 'DEMO102' } }).id, 10)
})

test('등록: 사번 중복은 409 (대소문자 무시, 삭제된 사원의 사번 포함), 저장소는 바뀌지 않음', () => {
  const { call, store } = setup()
  const dup = { message: '이미 사용된 사번입니다.', fieldErrors: { employeeNo: '이미 사용된 사번입니다.' } }
  expectError(() => call('/api/employees', { method: 'POST', body: { ...NEW_EMPLOYEE, employeeNo: 'demo001' } }), 409, dup)
  call('/api/employees/3', { method: 'DELETE' })
  expectError(() => call('/api/employees', { method: 'POST', body: { ...NEW_EMPLOYEE, employeeNo: 'DEMO003' } }), 409, dup)
  assert.equal(store.getState().employees.length, 8)
  assert.equal(store.getState().nextIds.employee, 9)
})

test('등록: 항목 검증 오류는 400 과 항목별 fieldErrors (서버와 같은 문구)', () => {
  const { call } = setup()
  expectError(() => call('/api/employees', { method: 'POST', body: { ...NEW_EMPLOYEE, employeeNo: '', name: '   ', hireDate: null } }), 400, {
    message: '입력값을 확인해 주세요.',
    fieldErrors: { employeeNo: '사번을 입력해 주세요.', name: '이름을 입력해 주세요.', hireDate: '입사일을 입력해 주세요.' },
  })
  expectError(() => call('/api/employees', { method: 'POST', body: { ...NEW_EMPLOYEE, employeeNo: 'DEMO 1' } }), 400, {
    fieldErrors: { employeeNo: '사번은 공백 없이 영문·숫자 20자 이내로 입력해 주세요.' },
  })
  expectError(() => call('/api/employees', { method: 'POST', body: { ...NEW_EMPLOYEE, phone: '01012345678', email: 'not-email', name: 'a'.repeat(51) } }), 400, {
    fieldErrors: {
      name: '이름은 50자 이하로 입력해 주세요.',
      phone: '전화번호는 010-1234-5678 또는 02-123-4567 형식으로 입력해 주세요.',
      email: '올바른 이메일 형식이 아닙니다.',
    },
  })
})

test('등록: 없는 날짜·잘못된 본문은 400 (본문을 읽을 수 없음)', () => {
  const { call } = setup()
  const notReadable = { message: '요청 형식이 올바르지 않습니다. JSON 형식과 날짜(YYYY-MM-DD), 재직 상태 값을 확인해 주세요.', fieldErrors: {} }
  expectError(() => call('/api/employees', { method: 'POST', body: { ...NEW_EMPLOYEE, hireDate: '2026-02-30' } }), 400, notReadable)
  expectError(() => call('/api/employees', { method: 'POST', body: null }), 400, notReadable)
  expectError(() => call('/api/employees', { method: 'POST', body: { ...NEW_EMPLOYEE, name: 123 } }), 400, notReadable)
})

test('사번 확인: 대문자로 바꾼 값과 사용 가능 여부 (삭제된 사원 사번은 사용 불가), 형식 오류·누락은 400', () => {
  const { call } = setup()
  assert.deepEqual(call('/api/employees/employee-no/check?value=demo001'), { employeeNo: 'DEMO001', available: false })
  assert.deepEqual(call(`/api/employees/employee-no/check?value=${encodeURIComponent('new01')}`), { employeeNo: 'NEW01', available: true })
  call('/api/employees/8', { method: 'DELETE' })
  assert.deepEqual(call('/api/employees/employee-no/check?value=DEMO008'), { employeeNo: 'DEMO008', available: false })
  expectError(() => call('/api/employees/employee-no/check?value=a%20b'), 400, { fieldErrors: { value: '사번은 공백 없이 영문·숫자 20자 이내로 입력해 주세요.' } })
  expectError(() => call('/api/employees/employee-no/check'), 400, { fieldErrors: { value: '값을 입력해 주세요.' } })
})

test('수정: 사번은 그대로, 나머지 전체 수정, 퇴사 처리와 재직 정정', () => {
  const { call } = setup()
  const body = { name: '가상일(수정)', hireDate: '2021-03-02', department: '재무팀', position: '과장', phone: '010-0000-0001', email: null, employmentStatus: 'RESIGNED', resignationDate: '2026-12-31', employeeNo: 'HACK01' }
  const updated = call('/api/employees/1', { method: 'PUT', body })
  assert.equal(updated.employeeNo, 'DEMO001')
  assert.equal(updated.name, '가상일(수정)')
  assert.equal(updated.employmentStatus, 'RESIGNED')
  assert.equal(updated.resignationDate, '2026-12-31')
  assert.equal(updated.phone, '010-0000-0001')
  const back = call('/api/employees/1', { method: 'PUT', body: { ...body, employmentStatus: 'ACTIVE', resignationDate: null } })
  assert.equal(back.employmentStatus, 'ACTIVE')
  assert.equal(back.resignationDate, null)
})

test('수정: 재직 상태·퇴사일 규칙 오류는 fieldErrors.resignationDate / 재직 상태 누락 / 없는 사원 404', () => {
  const { call } = setup()
  const base = { name: '가상일', hireDate: '2021-03-02', department: null, position: null, phone: null, email: null }
  expectError(() => call('/api/employees/1', { method: 'PUT', body: { ...base, employmentStatus: 'ACTIVE', resignationDate: '2026-01-01' } }), 400, { fieldErrors: { resignationDate: '재직 상태에서는 퇴사일을 비워 주세요.' } })
  expectError(() => call('/api/employees/1', { method: 'PUT', body: { ...base, employmentStatus: 'RESIGNED', resignationDate: null } }), 400, { fieldErrors: { resignationDate: '퇴사 상태에서는 퇴사일을 입력해 주세요.' } })
  expectError(() => call('/api/employees/1', { method: 'PUT', body: { ...base, employmentStatus: 'RESIGNED', resignationDate: '2020-01-01' } }), 400, { fieldErrors: { resignationDate: '퇴사일은 입사일보다 빠를 수 없습니다.' } })
  expectError(() => call('/api/employees/1', { method: 'PUT', body: { ...base, employmentStatus: null, resignationDate: null } }), 400, { fieldErrors: { employmentStatus: '재직 상태를 선택해 주세요.' } })
  expectError(() => call('/api/employees/1', { method: 'PUT', body: { ...base, employmentStatus: 'RETIRED', resignationDate: null } }), 400, { fieldErrors: {} })
  expectError(() => call('/api/employees/999', { method: 'PUT', body: { ...base, employmentStatus: 'ACTIVE', resignationDate: null } }), 404)
})

test('삭제: 논리 삭제(204, 데이터는 남고 삭제 시각 기록) → 목록·상세·수정·삭제에서 제외', () => {
  const { call, store } = setup()
  assert.equal(call('/api/employees/2', { method: 'DELETE' }), null)
  assert.equal(call('/api/employees').length, 7)
  const kept = store.getState().employees.find((e) => e.id === 2)
  assert.ok(kept, '행은 남아 있어야 함')
  assert.equal(typeof kept.deletedAt, 'string')
  expectError(() => call('/api/employees/2'), 404)
  expectError(() => call('/api/employees/2', { method: 'DELETE' }), 404)
  expectError(() => call('/api/employees/2', { method: 'PUT', body: { name: 'x', hireDate: '2020-01-01', employmentStatus: 'ACTIVE' } }), 404)
})

test('새로고침 후 유지: 등록·수정·삭제가 저장소에 남아 새 페이지(새 저장소 객체)에서도 보인다', () => {
  const { storage, call } = setup()
  call('/api/employees', { method: 'POST', body: NEW_EMPLOYEE })
  call('/api/employees/1', { method: 'PUT', body: { name: '가상일(수정)', hireDate: '2021-03-02', employmentStatus: 'ACTIVE' } })
  call('/api/employees/4', { method: 'DELETE' })
  const reloaded = createDemoStore({ storage })
  const list = handleDemoRequest(reloaded, '/api/employees')
  assert.equal(list.length, 8) // 8 + 1 - 1
  assert.ok(list.some((e) => e.employeeNo === 'DEMO101'))
  assert.ok(!list.some((e) => e.employeeNo === 'DEMO004'))
  assert.equal(list.find((e) => e.id === 1).name, '가상일(수정)')
  assert.ok(storage.data.has(STORAGE_KEY))
})

test('초기화 후 seed 복구: 변경이 사라지고 처음 사원 8명으로 돌아간다', () => {
  const { store, call } = setup()
  call('/api/employees', { method: 'POST', body: NEW_EMPLOYEE })
  call('/api/employees/5', { method: 'DELETE' })
  store.reset()
  const list = call('/api/employees')
  assert.deepEqual(list.map((e) => e.name), createSeedData().employees.map((e) => e.name))
  assert.deepEqual(call('/api/employees/employee-no/check?value=DEMO101'), { employeeNo: 'DEMO101', available: true })
})

test('응답은 복사본: 받은 값을 바꿔도 저장소는 바뀌지 않는다', () => {
  const { call } = setup()
  const list = call('/api/employees')
  list[0].name = '바뀜'
  assert.equal(call('/api/employees/1').name, '가상일')
})

test('지원하지 않는 방식 405, 없는 사원 경로 404, 사원별 연간 내역(화면 미사용)은 준비 중 501', () => {
  const { call } = setup()
  expectError(() => call('/api/employees', { method: 'DELETE' }), 405)
  expectError(() => call('/api/employees/1/unknown'), 404)
  const notReady = { message: '체험 모드에서 아직 준비 중인 기능입니다.' }
  for (const path of ['/api/employees/1/payrolls?year=2026']) {
    expectError(() => call(path), 501, notReady)
  }
})
