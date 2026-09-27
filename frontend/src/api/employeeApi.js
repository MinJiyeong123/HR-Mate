// ------------------------------------------------------------------
// 사원 API 호출 (백엔드 명세: docs/api/employee-api.md)
// - 화면(pages, components)은 이 파일의 함수만 사용한다.
// - 주소는 상대 경로(/api/...)를 쓴다. 개발 중에는 Vite 프록시가 백엔드(8080)로 전달한다.
// - 요청 본문에는 API 명세에 정의된 항목만 담는다.
// ------------------------------------------------------------------

const BASE_URL = '/api/employees'

const NETWORK_ERROR_MESSAGE = '서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인해 주세요.'

const DEFAULT_MESSAGES = {
  400: '입력값을 확인해 주세요.',
  404: '요청한 정보를 찾을 수 없습니다.',
  409: '이미 사용된 값입니다.',
}
const SERVER_ERROR_MESSAGE = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'

export class ApiError extends Error {
  constructor(status, message, fieldErrors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status // 0: 서버에 연결하지 못함
    this.fieldErrors = fieldErrors
  }
}

async function readJson(response) {
  const contentType = response.headers.get('Content-Type') ?? ''
  if (!contentType.includes('application/json')) return null
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const options = { method, headers: { Accept: 'application/json' } }
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }

  let response
  try {
    response = await fetch(path, options)
  } catch {
    throw new ApiError(0, NETWORK_ERROR_MESSAGE)
  }

  if (response.status === 204) return null

  const data = await readJson(response)
  if (response.ok) return data

  // 공통 오류 응답 { status, code, message, fieldErrors } 이 없으면(예: 프록시 오류) 상태별 기본 안내
  const fallback =
    response.status >= 500 ? (data ? SERVER_ERROR_MESSAGE : NETWORK_ERROR_MESSAGE) : DEFAULT_MESSAGES[response.status]
  throw new ApiError(response.status, data?.message ?? fallback ?? SERVER_ERROR_MESSAGE, data?.fieldErrors ?? {})
}

/** 등록 요청 본문 (명세 3장: 재직 상태는 보내지 않음) */
function toCreateBody(payload) {
  return {
    employeeNo: payload.employeeNo,
    name: payload.name,
    hireDate: payload.hireDate,
    department: payload.department,
    position: payload.position,
    phone: payload.phone,
    email: payload.email,
  }
}

/** 수정 요청 본문 (명세 4장: 사번은 보내지 않음) */
function toUpdateBody(payload) {
  return {
    name: payload.name,
    hireDate: payload.hireDate,
    department: payload.department,
    position: payload.position,
    phone: payload.phone,
    email: payload.email,
    employmentStatus: payload.employmentStatus,
    resignationDate: payload.resignationDate,
  }
}

/** 사원 목록 (삭제된 사원 제외, 사번 순) */
export function getEmployees() {
  return request(BASE_URL)
}

/** 사원 한 명 조회 (삭제된 사원은 404) */
export function getEmployee(id) {
  return request(`${BASE_URL}/${encodeURIComponent(id)}`)
}

/** 사번 사용 가능 여부 → { employeeNo, available } */
export function checkEmployeeNo(employeeNo) {
  return request(`${BASE_URL}/employee-no/check?value=${encodeURIComponent(employeeNo)}`)
}

/** 사원 등록. 재직 상태로 등록된다. */
export function createEmployee(payload) {
  return request(BASE_URL, { method: 'POST', body: toCreateBody(payload) })
}

/** 사원 수정. 사번은 바꿀 수 없다. */
export function updateEmployee(id, payload) {
  return request(`${BASE_URL}/${encodeURIComponent(id)}`, { method: 'PUT', body: toUpdateBody(payload) })
}

/** 사원 논리 삭제. 데이터는 남기고 삭제 시각만 기록한다. 사번은 계속 사용 중으로 취급한다. */
export async function deleteEmployee(id) {
  await request(`${BASE_URL}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
