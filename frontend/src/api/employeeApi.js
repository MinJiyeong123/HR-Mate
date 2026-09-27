import { EMPLOYMENT_STATUS } from '../constants/employmentStatus'
import { MOCK_EMPLOYEES } from '../mocks/mockEmployees'
import { normalizeEmployeeNo, validateEmployee } from '../utils/employeeValidation'

// ------------------------------------------------------------------
// 가짜(mock) 사원 API
// 백엔드가 준비되기 전까지 브라우저 메모리의 가상 데이터로 동작한다.
// - 새로고침하면 등록·수정한 내용이 초기 데이터로 되돌아간다.
// - 백엔드 연결 시 함수 이름과 입출력 형태는 유지하고 내부만 서버 호출로 교체한다.
//   화면(pages, components)은 이 파일의 함수만 사용한다.
// ------------------------------------------------------------------

const MOCK_DELAY_MS = 200

let employees = MOCK_EMPLOYEES.map((employee) => ({ ...employee }))

export class ApiError extends Error {
  constructor(status, message, fieldErrors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

function wait() {
  return new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS))
}

// 서버 응답에는 삭제 여부(deletedAt)를 포함하지 않는다.
function toResponse(employee) {
  return {
    id: employee.id,
    employeeNo: employee.employeeNo,
    name: employee.name,
    department: employee.department,
    position: employee.position,
    phone: employee.phone,
    email: employee.email,
    hireDate: employee.hireDate,
    employmentStatus: employee.employmentStatus,
    resignationDate: employee.resignationDate,
  }
}

function findActiveEmployee(id) {
  const employee = employees.find((item) => item.id === Number(id) && item.deletedAt === null)
  if (!employee) throw new ApiError(404, '사원 정보를 찾을 수 없습니다.')
  return employee
}

// 삭제된 사원까지 포함해서 검사한다. (삭제된 사원의 사번도 재사용 불가)
function isEmployeeNoTaken(employeeNo) {
  const normalized = normalizeEmployeeNo(employeeNo)
  return employees.some((item) => item.employeeNo === normalized)
}

function assertValid(payload, options) {
  const fieldErrors = validateEmployee(payload, options)
  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError(400, '입력값을 확인해 주세요.', fieldErrors)
  }
}

/** 사원 목록 (삭제된 사원 제외, 사번 순) */
export async function getEmployees() {
  await wait()
  return employees
    .filter((item) => item.deletedAt === null)
    .sort((a, b) => a.employeeNo.localeCompare(b.employeeNo))
    .map(toResponse)
}

/** 사원 한 명 조회 (삭제된 사원은 404) */
export async function getEmployee(id) {
  await wait()
  return toResponse(findActiveEmployee(id))
}

/** 사번 사용 가능 여부 */
export async function checkEmployeeNo(employeeNo) {
  await wait()
  return { available: !isEmployeeNoTaken(employeeNo) }
}

/** 사원 등록. 재직 상태로 등록된다. */
export async function createEmployee(payload) {
  await wait()
  const request = {
    ...payload,
    employmentStatus: EMPLOYMENT_STATUS.ACTIVE,
    resignationDate: null,
  }
  assertValid(request, { includeEmployeeNo: true })

  const employeeNo = normalizeEmployeeNo(request.employeeNo)
  if (isEmployeeNoTaken(employeeNo)) {
    throw new ApiError(409, '이미 사용된 사번입니다.', { employeeNo: '이미 사용된 사번입니다.' })
  }

  const nextId = employees.reduce((max, item) => Math.max(max, item.id), 0) + 1
  const created = { ...request, id: nextId, employeeNo, deletedAt: null }
  employees = [...employees, created]
  return toResponse(created)
}

/** 사원 수정. 사번은 바꿀 수 없으므로 요청에 사번이 있어도 무시한다. */
export async function updateEmployee(id, payload) {
  await wait()
  const current = findActiveEmployee(id)
  assertValid(payload, { includeEmployeeNo: false })

  const updated = {
    ...current,
    name: payload.name,
    hireDate: payload.hireDate,
    department: payload.department,
    position: payload.position,
    phone: payload.phone,
    email: payload.email,
    employmentStatus: payload.employmentStatus,
    resignationDate: payload.resignationDate,
  }
  employees = employees.map((item) => (item.id === current.id ? updated : item))
  return toResponse(updated)
}

/**
 * 사원 논리적 삭제. 데이터는 남기고 삭제 시각(deletedAt)만 기록한다.
 * 삭제된 사원은 목록·조회·수정에서 제외되지만 사번은 계속 사용 중으로 취급한다.
 */
export async function deleteEmployee(id) {
  await wait()
  const current = findActiveEmployee(id)
  const deleted = { ...current, deletedAt: new Date().toISOString() }
  employees = employees.map((item) => (item.id === current.id ? deleted : item))
}
