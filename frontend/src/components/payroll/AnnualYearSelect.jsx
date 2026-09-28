import { MAX_YEAR, MIN_YEAR, yearOptions } from '../../utils/payrollValidation'

/**
 * 연간 집계 연도 선택 (선택한 연도는 화면이 주소의 ?year= 로 관리한다)
 * 주소로 들어온 연도가 기본 목록(3년 전~1년 후) 밖이어도 2000~2100 안이면 목록에 넣는다.
 */
export default function AnnualYearSelect({ value, onChange }) {
  const selected = Number(value)
  const years = yearOptions()
  const validYear = Number.isInteger(selected) && selected >= MIN_YEAR && selected <= MAX_YEAR
  if (validYear && !years.includes(selected)) {
    years.push(selected)
    years.sort((a, b) => a - b)
  }

  return (
    <label className="year-select">
      <span>귀속 연도</span>
      <select
        className="input input--compact"
        value={validYear ? selected : ''}
        onChange={(event) => onChange(event.target.value)}
      >
        {!validYear && (
          <option value="" disabled>
            연도 선택
          </option>
        )}
        {years.map((year) => (
          <option key={year} value={year}>
            {year}년
          </option>
        ))}
      </select>
    </label>
  )
}
