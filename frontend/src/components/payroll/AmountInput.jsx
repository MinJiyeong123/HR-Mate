const formatter = new Intl.NumberFormat('ko-KR')

/**
 * 금액 입력 칸 (원 단위 정수)
 * - value 는 숫자만 담은 문자열("" 은 0원). 화면에는 천 단위 쉼표를 붙여 보여 준다.
 * - 숫자가 아닌 문자는 입력되지 않는다.
 */
export default function AmountInput({ id, value, onChange, invalid, describedBy, disabled }) {
  const display = value ? formatter.format(Number(value)) : ''

  function handleChange(event) {
    const digits = event.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 13)
    onChange(digits)
  }

  return (
    <div className="amount-input">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="input amount-input__field"
        value={display}
        onChange={handleChange}
        placeholder="0"
        aria-invalid={invalid}
        aria-describedby={describedBy}
        disabled={disabled}
      />
      <span className="amount-input__unit">원</span>
    </div>
  )
}
