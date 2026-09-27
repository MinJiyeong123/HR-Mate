import { useState } from 'react'
import { EMPLOYMENT_STATUS, EMPLOYMENT_STATUS_OPTIONS } from '../../constants/employmentStatus'
import {
  DEPARTMENT_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  EMPLOYEE_NO_MAX_LENGTH,
  NAME_MAX_LENGTH,
  POSITION_MAX_LENGTH,
  normalizeEmployeeNo,
  toEmployeePayload,
  validateEmployee,
  validateEmployeeNo,
} from '../../utils/employeeValidation'

const EMPTY_VALUES = {
  employeeNo: '',
  name: '',
  hireDate: '',
  department: '',
  position: '',
  phone: '',
  email: '',
  employmentStatus: EMPLOYMENT_STATUS.ACTIVE,
  resignationDate: '',
}

const IDLE_CHECK = { status: 'idle', employeeNo: '' }

function FormField({ id, label, required, error, hint, children }) {
  return (
    <div className={`form-field${error ? ' form-field--error' : ''}`}>
      <label htmlFor={id} className="form-field__label">
        {label}
        {required && <span className="form-field__required" aria-label="필수">*</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-message`} className="form-field__error" role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-message`} className="form-field__hint">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

/**
 * 사원 등록·수정 공용 입력 폼
 * - mode: 'create' | 'edit'
 * - onSubmit(payload): 저장 처리. 실패 시 { message, fieldErrors } 형태의 오류를 던진다.
 * - onCheckEmployeeNo(employeeNo): 등록 화면의 사번 중복 확인. { available } 을 돌려준다.
 */
export default function EmployeeForm({ mode, initialValues, onSubmit, onCancel, onCheckEmployeeNo }) {
  const isCreate = mode === 'create'
  const [values, setValues] = useState(() => ({ ...EMPTY_VALUES, ...initialValues }))
  const [errors, setErrors] = useState({})
  const [employeeNoCheck, setEmployeeNoCheck] = useState(IDLE_CHECK)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const isResigned = values.employmentStatus === EMPLOYMENT_STATUS.RESIGNED
  // 확인한 사번과 현재 입력한 사번이 같을 때만 확인 결과가 유효하다.
  const checkedStatus = employeeNoCheck.employeeNo === values.employeeNo ? employeeNoCheck.status : 'idle'

  function clearErrors(...names) {
    setErrors((prev) => {
      if (!names.some((name) => prev[name])) return prev
      const next = { ...prev }
      names.forEach((name) => delete next[name])
      return next
    })
  }

  function handleChange(event) {
    const { name, value } = event.target

    if (name === 'employeeNo') {
      setValues((prev) => ({ ...prev, employeeNo: normalizeEmployeeNo(value) }))
      clearErrors('employeeNo')
      return
    }

    if (name === 'employmentStatus') {
      // 재직으로 바꾸면 퇴사일을 비운다. (퇴사 → 재직 정정 시 퇴사일은 비어 있어야 함)
      setValues((prev) => ({
        ...prev,
        employmentStatus: value,
        resignationDate: value === EMPLOYMENT_STATUS.ACTIVE ? '' : prev.resignationDate,
      }))
      clearErrors('employmentStatus', 'resignationDate')
      return
    }

    setValues((prev) => ({ ...prev, [name]: value }))
    clearErrors(name, ...(name === 'hireDate' ? ['resignationDate'] : []))
  }

  async function handleCheckEmployeeNo() {
    const formatError = validateEmployeeNo(values.employeeNo)
    if (formatError) {
      setErrors((prev) => ({ ...prev, employeeNo: formatError }))
      return
    }

    const employeeNo = values.employeeNo
    setEmployeeNoCheck({ status: 'checking', employeeNo })
    try {
      const { available } = await onCheckEmployeeNo(employeeNo)
      setEmployeeNoCheck({ status: available ? 'available' : 'taken', employeeNo })
      if (!available) setErrors((prev) => ({ ...prev, employeeNo: '이미 사용된 사번입니다.' }))
    } catch {
      setEmployeeNoCheck(IDLE_CHECK)
      setFormError('사번 중복 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')

    const nextErrors = validateEmployee(values, { includeEmployeeNo: isCreate })
    if (isCreate && !nextErrors.employeeNo && checkedStatus !== 'available') {
      nextErrors.employeeNo =
        checkedStatus === 'taken' ? '이미 사용된 사번입니다.' : '사번 중복 확인을 해 주세요.'
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      setFormError('입력값을 확인해 주세요.')
      return
    }

    setSubmitting(true)
    try {
      await onSubmit(toEmployeePayload(values, { includeEmployeeNo: isCreate }))
    } catch (error) {
      setErrors(error.fieldErrors ?? {})
      setFormError(error.message || '저장 중 오류가 발생했습니다.')
      setSubmitting(false)
    }
  }

  const describedBy = (name) => (errors[name] ? `${name}-message` : undefined)

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      {formError && (
        <div className="alert alert--error" role="alert">
          {formError}
        </div>
      )}

      <section className="form-section">
        <h2 className="form-section__title">기본 정보</h2>
        <div className="form-grid">
          <FormField
            id="employeeNo"
            label="사번"
            required={isCreate}
            error={errors.employeeNo}
            hint={
              isCreate
                ? checkedStatus === 'available'
                  ? '✓ 사용 가능한 사번입니다.'
                  : `영문·숫자 ${EMPLOYEE_NO_MAX_LENGTH}자 이내, 자동으로 대문자로 저장됩니다.`
                : '사번은 등록 후 수정할 수 없습니다.'
            }
          >
            <div className="input-group">
              <input
                id="employeeNo"
                name="employeeNo"
                className={`input${checkedStatus === 'available' ? ' input--success' : ''}`}
                value={values.employeeNo}
                onChange={handleChange}
                maxLength={EMPLOYEE_NO_MAX_LENGTH}
                readOnly={!isCreate}
                autoComplete="off"
                placeholder="예: E2026001"
                aria-invalid={Boolean(errors.employeeNo)}
                aria-describedby={`employeeNo-message`}
              />
              {isCreate && (
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={handleCheckEmployeeNo}
                  disabled={checkedStatus === 'checking' || values.employeeNo === ''}
                >
                  {checkedStatus === 'checking' ? '확인 중…' : '중복 확인'}
                </button>
              )}
            </div>
          </FormField>

          <FormField id="name" label="이름" required error={errors.name}>
            <input
              id="name"
              name="name"
              className="input"
              value={values.name}
              onChange={handleChange}
              maxLength={NAME_MAX_LENGTH}
              autoComplete="off"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={describedBy('name')}
            />
          </FormField>

          <FormField id="hireDate" label="입사일" required error={errors.hireDate}>
            <input
              id="hireDate"
              name="hireDate"
              type="date"
              className="input"
              value={values.hireDate}
              onChange={handleChange}
              aria-invalid={Boolean(errors.hireDate)}
              aria-describedby={describedBy('hireDate')}
            />
          </FormField>
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section__title">소속 정보</h2>
        <div className="form-grid">
          <FormField id="department" label="부서" error={errors.department}>
            <input
              id="department"
              name="department"
              className="input"
              value={values.department}
              onChange={handleChange}
              maxLength={DEPARTMENT_MAX_LENGTH}
              placeholder="예: 인사팀"
              aria-invalid={Boolean(errors.department)}
              aria-describedby={describedBy('department')}
            />
          </FormField>

          <FormField id="position" label="직급" error={errors.position}>
            <input
              id="position"
              name="position"
              className="input"
              value={values.position}
              onChange={handleChange}
              maxLength={POSITION_MAX_LENGTH}
              placeholder="예: 대리"
              aria-invalid={Boolean(errors.position)}
              aria-describedby={describedBy('position')}
            />
          </FormField>
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section__title">연락처</h2>
        <div className="form-grid">
          <FormField id="phone" label="전화번호" error={errors.phone} hint="예: 010-1234-5678, 02-123-4567">
            <input
              id="phone"
              name="phone"
              type="tel"
              className="input"
              value={values.phone}
              onChange={handleChange}
              placeholder="010-0000-0000"
              aria-invalid={Boolean(errors.phone)}
              aria-describedby="phone-message"
            />
          </FormField>

          <FormField id="email" label="이메일" error={errors.email}>
            <input
              id="email"
              name="email"
              type="email"
              className="input"
              value={values.email}
              onChange={handleChange}
              maxLength={EMAIL_MAX_LENGTH}
              placeholder="name@example.com"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={describedBy('email')}
            />
          </FormField>
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section__title">재직 정보</h2>
        {isCreate ? (
          <p className="form-section__note">신규 사원은 재직 상태로 등록됩니다. 퇴사 처리는 등록 후 수정 화면에서 할 수 있습니다.</p>
        ) : (
          <div className="form-grid">
            <div className="form-field">
              <span className="form-field__label" id="employmentStatus-label">
                재직 상태<span className="form-field__required" aria-label="필수">*</span>
              </span>
              <div className="segmented" role="radiogroup" aria-labelledby="employmentStatus-label">
                {EMPLOYMENT_STATUS_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`segmented__option${values.employmentStatus === option.value ? ' segmented__option--selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="employmentStatus"
                      value={option.value}
                      checked={values.employmentStatus === option.value}
                      onChange={handleChange}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              {errors.employmentStatus && <p className="form-field__error">{errors.employmentStatus}</p>}
            </div>

            <FormField
              id="resignationDate"
              label="퇴사일"
              required={isResigned}
              error={errors.resignationDate}
              hint={isResigned ? '입사일 이후 날짜만 입력할 수 있습니다.' : '퇴사 상태를 선택하면 입력할 수 있습니다.'}
            >
              <input
                id="resignationDate"
                name="resignationDate"
                type="date"
                className="input"
                value={values.resignationDate}
                onChange={handleChange}
                min={values.hireDate || undefined}
                disabled={!isResigned}
                aria-invalid={Boolean(errors.resignationDate)}
                aria-describedby="resignationDate-message"
              />
            </FormField>
          </div>
        )}
      </section>

      <div className="form-actions">
        <button type="button" className="button button--ghost" onClick={onCancel} disabled={submitting}>
          취소
        </button>
        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting ? '저장 중…' : isCreate ? '등록' : '저장'}
        </button>
      </div>
    </form>
  )
}
