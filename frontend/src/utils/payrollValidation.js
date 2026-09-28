// 규칙 출처: docs/requirements-payroll.md (백엔드 PayrollPeriodCreateRequest 와 같은 범위)
// 화면 검증은 사용자 편의를 위한 것이며, 최종 검증은 서버가 담당한다.

export const MIN_YEAR = 2000
export const MAX_YEAR = 2100
export const DEFAULT_PAYMENT_DAY = 25

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** 연도 선택 목록: 올해 기준 3년 전 ~ 1년 후 */
export function yearOptions(today = new Date()) {
  const current = today.getFullYear()
  const years = []
  for (let year = current - 3; year <= current + 1; year += 1) {
    if (year >= MIN_YEAR && year <= MAX_YEAR) years.push(year)
  }
  return years
}

/** 선택한 연월의 25일 (말일이 25일보다 이르면 말일) → "YYYY-MM-DD" */
export function suggestPaymentDate(year, month) {
  const lastDay = new Date(year, month, 0).getDate()
  const day = Math.min(DEFAULT_PAYMENT_DAY, lastDay)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function isValidDate(value) {
  return DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value))
}

/** 급여 기간 입력 검증 → { 항목: 오류 메시지 } */
export function validatePeriod({ year, month, paymentDate }) {
  const errors = {}
  const yearNumber = Number(year)
  const monthNumber = Number(month)
  if (!year || !Number.isInteger(yearNumber) || yearNumber < MIN_YEAR || yearNumber > MAX_YEAR) {
    errors.year = `연도는 ${MIN_YEAR}~${MAX_YEAR} 사이로 입력해 주세요.`
  }
  if (!month || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    errors.month = '월은 1~12 사이로 입력해 주세요.'
  }
  if (!paymentDate) errors.paymentDate = '지급일을 입력해 주세요.'
  else if (!isValidDate(paymentDate)) errors.paymentDate = '올바른 날짜를 입력해 주세요.'
  return errors
}
