// ------------------------------------------------------------------
// 급여 API 호출 (백엔드 명세: docs/api/payroll-api.md) - 포트폴리오용 시뮬레이션
// - 화면(pages, components)은 이 파일의 함수만 사용한다.
// - 요청 본문에는 API 명세에 정의된 항목만 담는다.
// - 급여 기간(목록·생성·상세·지급일 수정·확정·확정 취소), 항목, 급여(입력·조회·수정·삭제)
// ------------------------------------------------------------------

import { request } from './client'

const PERIOD_URL = '/api/payroll-periods'
const PAYROLL_URL = '/api/payrolls'

function payrollPath(id) {
  return `${PAYROLL_URL}/${encodeURIComponent(id)}`
}

/** lines: [{ payItemId, amount }] → 명세 항목만 담은 배열 */
function toLines(lines) {
  return lines.map(({ payItemId, amount }) => ({ payItemId, amount }))
}

/** 지급·공제 항목 12개 (표시 순서) */
export function getPayItems() {
  return request('/api/pay-items')
}

/** 이 기간에 급여를 입력할 수 있는 사원 (해당 월 재직 + 아직 급여 없음) */
export function getEligibleEmployees(periodId) {
  return request(`${PERIOD_URL}/${encodeURIComponent(periodId)}/eligible-employees`)
}

/** 급여 입력 { employeeId, lines, memo } → 명세서 */
export function createPayroll(periodId, { employeeId, lines, memo }) {
  return request(`${PERIOD_URL}/${encodeURIComponent(periodId)}/payrolls`, {
    method: 'POST',
    body: { employeeId, lines: toLines(lines), memo },
  })
}

/** 급여명세서 */
export function getPayroll(id) {
  return request(payrollPath(id))
}

/** 급여 수정 { lines, memo } (사원은 바꿀 수 없음) → 명세서 */
export function updatePayroll(id, { lines, memo }) {
  return request(payrollPath(id), { method: 'PUT', body: { lines: toLines(lines), memo } })
}

/** 급여 삭제 (작성 중인 기간만) */
export async function deletePayroll(id) {
  await request(payrollPath(id), { method: 'DELETE' })
}

function periodPath(id) {
  return `${PERIOD_URL}/${encodeURIComponent(id)}`
}

/** 급여 기간 목록 (최신 연월부터, 인원·합계 포함) */
export function getPayrollPeriods() {
  return request(PERIOD_URL)
}

/** 급여 기간 상세 (요약 + 사원별 급여) */
export function getPayrollPeriod(id) {
  return request(periodPath(id))
}

/** 급여 기간 생성 { year, month, paymentDate } */
export function createPayrollPeriod({ year, month, paymentDate }) {
  return request(PERIOD_URL, { method: 'POST', body: { year, month, paymentDate } })
}

/** 지급일 수정 (작성 중일 때만) */
export function updatePayrollPeriod(id, { paymentDate }) {
  return request(periodPath(id), { method: 'PUT', body: { paymentDate } })
}

/** 확정 (급여 1건 이상) */
export function confirmPayrollPeriod(id) {
  return request(`${periodPath(id)}/confirm`, { method: 'POST' })
}

/** 확정 취소 */
export function reopenPayrollPeriod(id) {
  return request(`${periodPath(id)}/reopen`, { method: 'POST' })
}
