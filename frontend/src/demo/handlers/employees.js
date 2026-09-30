// ------------------------------------------------------------------
// 체험 모드 사원 API (브라우저 저장소 사용, 네트워크 요청 없음)
// 계약: docs/api/employee-api.md / 규칙 원본: 백엔드 EmployeeService·Employee·EmployeeCreateRequest·EmployeeUpdateRequest
//   GET    /api/employees                         목록 (삭제 제외, 사번 순)
//   GET    /api/employees/{id}                    상세 (삭제된 사원 404)
//   GET    /api/employees/employee-no/check?value= 사번 사용 가능 여부
//   POST   /api/employees                         등록 (재직 상태, 사번 대문자, 삭제된 사원 사번도 중복)
//   PUT    /api/employees/{id}                    수정 (사번 제외 전체 수정)
//   DELETE /api/employees/{id}                    논리 삭제 (삭제 시각만 기록, 사번은 계속 사용 중)
// ------------------------------------------------------------------
import { ApiError, invalidInput, methodNotAllowed, notFoundPath, notReadable, notReady, typeMismatch } from '../errors.js'

const EMPLOYEE_NO_MAX_LENGTH = 20
const EMPLOYEE_NO_FORMAT_MESSAGE = `사번은 공백 없이 영문·숫자 ${EMPLOYEE_NO_MAX_LENGTH}자 이내로 입력해 주세요.`
const EMPLOYEE_NO_PATTERN = /^[A-Za-z0-9]{1,20}$/
const PHONE_PATTERN = /^$|^0\d{1,2}-\d{3,4}-\d{4}$/
// 서버의 @Email 에 가깝게: 공백·@ 없는 앞부분 @ 점으로 구분된 도메인 (빈 문자열은 허용)
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const STATUSES = ['ACTIVE', 'RESIGNED']

const NOT_FOUND = () => new ApiError(404, '사원 정보를 찾을 수 없습니다.', {})
const DUPLICATED = () => new ApiError(409, '이미 사용된 사번입니다.', { employeeNo: '이미 사용된 사번입니다.' })

const isBlank = (value) => value === null || value === undefined || String(value).trim() === ''
const trimToNull = (value) => (isBlank(value) ? null : String(value).trim())

/** 실제로 있는 날짜인지 (예: 2026-02-30 은 아님) */
function isRealDate(value) {
  if (!DATE_PATTERN.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/** 서버가 JSON 을 읽는 단계의 검사: 문자열 항목, 날짜, 재직 상태 값. 틀리면 400 (항목 오류 없음) */
function readBody(body, { stringFields, dateFields, statusField }) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw notReadable()
  for (const field of stringFields) {
    const value = body[field]
    if (value !== undefined && value !== null && typeof value !== 'string') throw notReadable()
  }
  for (const field of dateFields) {
    const value = body[field]
    if (value !== undefined && value !== null && (typeof value !== 'string' || !isRealDate(value))) throw notReadable()
  }
  if (statusField) {
    const value = body[statusField]
    if (value !== undefined && value !== null && !STATUSES.includes(value)) throw notReadable()
  }
  const read = (field) => (body[field] === undefined ? null : body[field])
  return Object.fromEntries([...stringFields, ...dateFields, ...(statusField ? [statusField] : [])].map((f) => [f, read(f)]))
}

/** 이름·입사일·부서·직급·전화·이메일 검증 (등록·수정 공통). 항목마다 첫 오류만 남긴다. */
function validateCommon(input, errors) {
  const put = (field, message) => {
    if (!(field in errors)) errors[field] = message
  }
  if (isBlank(input.name)) put('name', '이름을 입력해 주세요.')
  else if (input.name.length > 50) put('name', '이름은 50자 이하로 입력해 주세요.')
  if (input.hireDate === null) put('hireDate', '입사일을 입력해 주세요.')
  if (input.department !== null && input.department.length > 100) put('department', '부서는 100자 이하로 입력해 주세요.')
  if (input.position !== null && input.position.length > 50) put('position', '직급은 50자 이하로 입력해 주세요.')
  if (input.phone !== null && !PHONE_PATTERN.test(input.phone)) {
    put('phone', '전화번호는 010-1234-5678 또는 02-123-4567 형식으로 입력해 주세요.')
  }
  if (input.email !== null && input.email !== '') {
    if (!EMAIL_PATTERN.test(input.email)) put('email', '올바른 이메일 형식이 아닙니다.')
    else if (input.email.length > 100) put('email', '이메일은 100자 이하로 입력해 주세요.')
  }
}

const COMMON_STRINGS = ['name', 'department', 'position', 'phone', 'email']

function toResponse(e) {
  return {
    id: e.id,
    employeeNo: e.employeeNo,
    name: e.name,
    department: e.department,
    position: e.position,
    phone: e.phone,
    email: e.email,
    hireDate: e.hireDate,
    employmentStatus: e.employmentStatus,
    resignationDate: e.resignationDate,
  }
}

function parseId(raw) {
  if (!/^-?\d+$/.test(raw)) throw typeMismatch('id')
  const id = Number(raw)
  if (!Number.isSafeInteger(id)) throw typeMismatch('id')
  return id
}

const findActive = (state, id) => state.employees.find((e) => e.id === id && e.deletedAt === null)
const employeeNoTaken = (state, employeeNo) => state.employees.some((e) => e.employeeNo === employeeNo)

function list(store) {
  return store
    .getState()
    .employees.filter((e) => e.deletedAt === null)
    .sort((a, b) => (a.employeeNo < b.employeeNo ? -1 : a.employeeNo > b.employeeNo ? 1 : 0))
    .map(toResponse)
}

function detail(store, id) {
  const employee = findActive(store.getState(), id)
  if (!employee) throw NOT_FOUND()
  return toResponse(employee)
}

function checkEmployeeNo(store, searchParams) {
  if (!searchParams.has('value')) throw invalidInput({ value: '값을 입력해 주세요.' })
  const value = searchParams.get('value')
  if (!EMPLOYEE_NO_PATTERN.test(value)) throw invalidInput({ value: EMPLOYEE_NO_FORMAT_MESSAGE })
  const employeeNo = value.toUpperCase()
  return { employeeNo, available: !employeeNoTaken(store.getState(), employeeNo) }
}

function create(store, body) {
  const input = readBody(body, { stringFields: ['employeeNo', ...COMMON_STRINGS], dateFields: ['hireDate'] })
  const errors = {}
  if (isBlank(input.employeeNo)) errors.employeeNo = '사번을 입력해 주세요.'
  else if (!EMPLOYEE_NO_PATTERN.test(input.employeeNo)) errors.employeeNo = EMPLOYEE_NO_FORMAT_MESSAGE
  validateCommon(input, errors)
  if (Object.keys(errors).length > 0) throw invalidInput(errors)

  const employeeNo = input.employeeNo.toUpperCase()
  return store.update((state) => {
    if (employeeNoTaken(state, employeeNo)) throw DUPLICATED()
    const employee = {
      id: state.nextIds.employee,
      employeeNo,
      name: input.name.trim(),
      department: trimToNull(input.department),
      position: trimToNull(input.position),
      phone: trimToNull(input.phone),
      email: trimToNull(input.email),
      hireDate: input.hireDate,
      employmentStatus: 'ACTIVE',
      resignationDate: null,
      deletedAt: null,
    }
    state.nextIds.employee += 1
    state.employees.push(employee)
    return toResponse(employee)
  })
}

function update(store, id, body) {
  // 서버와 같은 순서: 본문 검사(400) → 사원 찾기(404)
  const input = readBody(body, { stringFields: COMMON_STRINGS, dateFields: ['hireDate', 'resignationDate'], statusField: 'employmentStatus' })
  const errors = {}
  validateCommon(input, errors)
  if (input.employmentStatus === null) errors.employmentStatus = '재직 상태를 선택해 주세요.'
  else if (input.employmentStatus === 'ACTIVE' && input.resignationDate !== null) {
    errors.resignationDate = '재직 상태에서는 퇴사일을 비워 주세요.'
  } else if (input.employmentStatus === 'RESIGNED') {
    if (input.resignationDate === null) errors.resignationDate = '퇴사 상태에서는 퇴사일을 입력해 주세요.'
    else if (input.hireDate !== null && input.resignationDate < input.hireDate) {
      errors.resignationDate = '퇴사일은 입사일보다 빠를 수 없습니다.'
    }
  }
  if (Object.keys(errors).length > 0) throw invalidInput(errors)

  return store.update((state) => {
    const employee = findActive(state, id)
    if (!employee) throw NOT_FOUND()
    employee.name = input.name.trim()
    employee.department = trimToNull(input.department)
    employee.position = trimToNull(input.position)
    employee.phone = trimToNull(input.phone)
    employee.email = trimToNull(input.email)
    employee.hireDate = input.hireDate
    employee.employmentStatus = input.employmentStatus
    employee.resignationDate = input.employmentStatus === 'RESIGNED' ? input.resignationDate : null
    return toResponse(employee)
  })
}

function remove(store, id) {
  store.update((state) => {
    const employee = findActive(state, id)
    if (!employee) throw NOT_FOUND()
    employee.deletedAt = new Date().toISOString()
  })
  return null // 204 본문 없음
}

/**
 * /api/employees 로 시작하는 요청을 처리한다.
 * @param segments '/api/employees' 뒤의 경로 조각 (예: ['7'], ['employee-no', 'check'])
 */
export function handleEmployees(store, { method, segments, searchParams, body }) {
  if (segments.length === 0) {
    if (method === 'GET') return list(store)
    if (method === 'POST') return create(store, body)
    throw methodNotAllowed()
  }
  if (segments.length === 2 && segments[0] === 'employee-no' && segments[1] === 'check') {
    if (method === 'GET') return checkEmployeeNo(store, searchParams)
    throw methodNotAllowed()
  }
  if (segments.length === 1) {
    const id = parseId(segments[0])
    if (method === 'GET') return detail(store, id)
    if (method === 'PUT') return update(store, id, body)
    if (method === 'DELETE') return remove(store, id)
    throw methodNotAllowed()
  }
  // 사원별 연간 급여(/api/employees/{id}/payrolls)는 급여 기능이라 아직 준비 중
  if (segments.length === 2 && segments[1] === 'payrolls') throw notReady()
  throw notFoundPath()
}
