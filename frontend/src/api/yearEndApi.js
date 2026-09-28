// ------------------------------------------------------------------
// 연말정산 API 호출 (백엔드 명세: docs/api/year-end-api.md) - 포트폴리오용 모의 계산
// - 화면(pages, components)은 이 파일의 함수만 사용한다.
// - 요청 본문에는 API 명세에 정의된 입력 항목 10개만 담는다.
// ------------------------------------------------------------------

import { request } from './client'
import { INPUT_FIELDS } from '../utils/yearEndValidation'

function employeesPath(year) {
  return `/api/year-end/${encodeURIComponent(year)}/employees`
}

function employeePath(year, employeeId) {
  return `${employeesPath(year)}/${encodeURIComponent(employeeId)}`
}

/** 그 해 확정 급여가 있는 사원 목록과 계산 요약 */
export function getYearEndEmployees(year) {
  return request(employeesPath(year))
}

/** 입력 자료 (없으면 saved=false 와 기본값) */
export function getYearEndInput(year, employeeId) {
  return request(`${employeePath(year, employeeId)}/input`)
}

/** 입력 자료 저장 (생성 또는 전체 교체) */
export function saveYearEndInput(year, employeeId, values) {
  const body = Object.fromEntries(INPUT_FIELDS.map((field) => [field, values[field]]))
  return request(`${employeePath(year, employeeId)}/input`, { method: 'PUT', body })
}

/** 모의 계산 결과 (확정 급여가 없으면 calculable=false) */
export function getYearEndResult(year, employeeId) {
  return request(`${employeePath(year, employeeId)}/result`)
}
