// ------------------------------------------------------------------
// 체험 모드 가짜 서버: 요청 주소·방식을 보고 처리 함수를 찾는다 (네트워크 요청 없음)
// - D1-4: 사원(/api/employees), 급여 항목·기간·급여(/api/pay-items, /api/payroll-periods, /api/payrolls) 를 처리.
//   연간 집계(/api/payroll-summaries), 사원별 연간 내역, 연말정산 등 나머지는 "준비 중"(501).
// - 응답은 복사본으로 돌려준다(화면이 값을 바꿔도 저장소에 영향 없음).
// ------------------------------------------------------------------
import { ApiError, notReady } from './errors.js'
import { handleEmployees } from './handlers/employees.js'
import { handlePayItems, handlePayrollPeriods, handlePayrolls } from './handlers/payroll.js'
import { DemoStorageError } from './storage.js'

const HANDLERS = {
  employees: handleEmployees,
  'pay-items': handlePayItems,
  'payroll-periods': handlePayrollPeriods,
  payrolls: handlePayrolls,
}

const clone = (value) => (value === null || value === undefined ? null : JSON.parse(JSON.stringify(value)))

/**
 * @param store createDemoStore() 가 만든 저장소
 * @param path  '/api/employees/7?x=1' 처럼 api/*.js 가 넘기는 주소
 * @returns 응답 본문 (204 는 null). 오류는 ApiError 로 던진다.
 */
export function handleDemoRequest(store, path, { method = 'GET', body } = {}) {
  const url = new URL(path, 'http://demo.invalid')
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
  try {
    const handler = parts[0] === 'api' && Object.hasOwn(HANDLERS, parts[1] ?? '') ? HANDLERS[parts[1]] : undefined
    if (handler) {
      return clone(handler(store, { method, segments: parts.slice(2), searchParams: url.searchParams, body: clone(body) }))
    }
    throw notReady()
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof DemoStorageError) throw new ApiError(507, error.message, {})
    throw new ApiError(500, '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.', {})
  }
}
