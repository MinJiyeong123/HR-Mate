// 급여 기간 상태. 백엔드 enum(PayrollPeriodStatus)과 같은 문자열을 사용한다.
export const PAYROLL_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
})

export const PAYROLL_STATUS_LABEL = Object.freeze({
  [PAYROLL_STATUS.DRAFT]: '작성 중',
  [PAYROLL_STATUS.CONFIRMED]: '확정',
})
