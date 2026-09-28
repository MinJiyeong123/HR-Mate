// ------------------------------------------------------------------
// 급여 API 호출 (백엔드 명세: docs/api/payroll-api.md) - 포트폴리오용 시뮬레이션
// - 화면(pages, components)은 이 파일의 함수만 사용한다.
// - 요청 본문에는 API 명세에 정의된 항목만 담는다.
// - 2-4단계: 급여 기간 목록·생성·상세·지급일 수정·확정·확정 취소
// ------------------------------------------------------------------

import { request } from './client'

const PERIOD_URL = '/api/payroll-periods'

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
