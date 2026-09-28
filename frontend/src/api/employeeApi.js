// ------------------------------------------------------------------
// 사원 API 호출 (백엔드 명세: docs/api/employee-api.md)
// - 화면(pages, components)은 이 파일의 함수만 사용한다.
// - 요청·오류 처리는 공통 모듈(api/client.js)을 사용한다.
// - 요청 본문에는 API 명세에 정의된 항목만 담는다.
// ------------------------------------------------------------------

import { request } from './client'

export { ApiError } from './client'

const BASE_URL = '/api/employees'

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
