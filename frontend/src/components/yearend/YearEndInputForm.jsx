import { useState } from 'react'
import CountDropdown from '../common/CountDropdown'
import { basicDeductionCount, maxCounts, validateYearEndInput } from '../../utils/yearEndValidation'

/** 예/아니요 선택 (기존 사원 화면의 segmented 스타일) */
function YesNo({ name, label, value, onChange, disabled, hint }) {
  return (
    <div className="form-field">
      <span className="form-field__label" id={`${name}-label`}>
        {label}
      </span>
      <div className="segmented" role="radiogroup" aria-labelledby={`${name}-label`}>
        {[
          { value: true, text: '예' },
          { value: false, text: '아니요' },
        ].map((option) => (
          <label
            key={option.text}
            className={`segmented__option${value === option.value ? ' segmented__option--selected' : ''}`}
          >
            <input
              type="radio"
              name={name}
              checked={value === option.value}
              onChange={() => onChange(name, option.value)}
              disabled={disabled}
            />
            {option.text}
          </label>
        ))}
      </div>
      {hint && <p className="form-field__hint">{hint}</p>}
    </div>
  )
}

/** 인원 선택 (0 ~ 최대값, 커스텀 드롭다운). 현재 값이 최대값을 넘으면 목록에 남겨 오류로 안내한다. */
function CountSelect({ name, label, value, max, onChange, disabled, error, hint }) {
  const messageId = `${name}-message`
  return (
    <div className={`form-field${error ? ' form-field--error' : ''}`}>
      <label htmlFor={name} id={`${name}-label`} className="form-field__label">
        {label}
      </label>
      <CountDropdown
        id={name}
        labelId={`${name}-label`}
        value={value}
        max={max}
        onChange={(count) => onChange(name, count)}
        disabled={disabled}
        invalid={Boolean(error)}
        describedBy={error || hint ? messageId : undefined}
      />
      {error ? (
        <p id={messageId} className="form-field__error">
          {error}
        </p>
      ) : (
        hint && (
          <p id={messageId} className="form-field__hint">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

/**
 * 연말정산 입력 폼 (인원 수·해당 여부만, 개인 식별 정보 없음)
 * - onSubmit(values): 실패 시 { message, fieldErrors } 오류를 던진다.
 * - readOnly: 삭제된 사원 등 저장할 수 없을 때
 */
export default function YearEndInputForm({ initialValues, readOnly = false, onSubmit, onCancel }) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const disabled = readOnly || submitting
  const max = maxCounts(values)

  function handleChange(name, value) {
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => {
      const next = { ...current }
      delete next[name]
      delete next.input
      return next
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')
    const nextErrors = validateYearEndInput(values)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      setFormError(nextErrors.input ?? '입력값을 확인해 주세요.')
      return
    }
    setSubmitting(true)
    try {
      await onSubmit(values)
    } catch (error) {
      const fieldErrors = error.fieldErrors ?? {}
      setErrors(fieldErrors)
      setFormError(fieldErrors.input ?? error.message ?? '저장 중 오류가 발생했습니다.')
      setSubmitting(false)
    }
  }

  const common = { onChange: handleChange, disabled }

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      {formError && (
        <div className="alert alert--error" role="alert">
          {formError}
        </div>
      )}

      <section className="form-section">
        <h2 className="form-section__title">
          인적공제 <span className="form-section__sub">이름·주민등록번호는 입력하지 않습니다. 인원 수만 입력합니다.</span>
        </h2>
        <div className="form-grid">
          <YesNo
            name="spouseDeduction"
            label="배우자 기본공제"
            value={values.spouseDeduction}
            hint="연간 소득금액 100만원 이하(근로소득만 있으면 총급여 500만원 이하)인 배우자"
            {...common}
          />
          <CountSelect
            name="dependentCount"
            label="부양가족 기본공제 인원"
            value={values.dependentCount}
            max={max.dependentCount}
            error={errors.dependentCount}
            hint="본인·배우자 제외. 나이·소득·동거 요건은 직접 판단해 주세요."
            {...common}
          />
          <CountSelect
            name="elderlyCount"
            label="경로우대(70세 이상) 인원"
            value={values.elderlyCount}
            max={max.elderlyCount}
            error={errors.elderlyCount}
            hint={`기본공제 대상자 ${basicDeductionCount(values)}명 이하`}
            {...common}
          />
          <CountSelect
            name="disabledCount"
            label="장애인 인원"
            value={values.disabledCount}
            max={max.disabledCount}
            error={errors.disabledCount}
            hint={`기본공제 대상자 ${basicDeductionCount(values)}명 이하`}
            {...common}
          />
          <YesNo
            name="womanDeduction"
            label="부녀자 공제"
            value={values.womanDeduction}
            hint="근로소득금액 3천만원 이하일 때만 적용됩니다."
            {...common}
          />
          <YesNo
            name="singleParentDeduction"
            label="한부모 공제"
            value={values.singleParentDeduction}
            hint="배우자 기본공제와 함께 선택할 수 없습니다. 부녀자와 함께 선택하면 한부모만 적용됩니다."
            {...common}
          />
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section__title">자녀세액공제</h2>
        <div className="form-grid">
          <CountSelect
            name="childCreditCount"
            label="자녀세액공제 대상 자녀 수"
            value={values.childCreditCount}
            max={max.childCreditCount}
            error={errors.childCreditCount}
            hint="기본공제 대상 자녀·손자녀 중 8세 이상 (2025년 귀속 국세청 안내 기준), 부양가족 인원 이하"
            {...common}
          />
          <CountSelect
            name="birthFirstCount"
            label="올해 출산·입양: 첫째"
            value={values.birthFirstCount}
            max={max.birthFirstCount}
            error={errors.birthFirstCount}
            {...common}
          />
          <CountSelect
            name="birthSecondCount"
            label="올해 출산·입양: 둘째"
            value={values.birthSecondCount}
            max={max.birthSecondCount}
            error={errors.birthSecondCount}
            {...common}
          />
          <CountSelect
            name="birthThirdPlusCount"
            label="올해 출산·입양: 셋째 이상"
            value={values.birthThirdPlusCount}
            max={max.birthThirdPlusCount}
            error={errors.birthThirdPlusCount}
            hint="출산·입양 자녀 수의 합은 부양가족 인원 이하"
            {...common}
          />
        </div>
      </section>

      <div className="form-actions">
        <button type="button" className="button button--ghost" onClick={onCancel} disabled={submitting}>
          {readOnly ? '돌아가기' : '취소'}
        </button>
        {!readOnly && (
          <button type="submit" className="button button--primary" disabled={submitting}>
            {submitting ? '저장 중…' : '저장'}
          </button>
        )}
      </div>
    </form>
  )
}
