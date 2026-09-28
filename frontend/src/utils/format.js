const wonFormatter = new Intl.NumberFormat('ko-KR')

/** 3200000 → "3,200,000원" (값이 없으면 "-") */
export function formatWon(amount) {
  if (amount === null || amount === undefined) return '-'
  return `${wonFormatter.format(amount)}원`
}

/** (2026, 4) → "2026년 4월" */
export function formatYearMonth(year, month) {
  return `${year}년 ${month}월`
}

/** "2026-09-28T10:15:30.123" → "2026-09-28 10:15" (값이 없으면 "-") */
export function formatDateTime(value) {
  if (!value) return '-'
  return value.slice(0, 16).replace('T', ' ')
}
