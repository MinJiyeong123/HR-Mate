import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPayrollPeriod } from '../api/payrollApi'
import PageHeader from '../components/layout/PageHeader'
import SimulationNotice from '../components/payroll/SimulationNotice'
import { formatYearMonth } from '../utils/format'
import { suggestPaymentDate, validatePeriod, yearOptions } from '../utils/payrollValidation'

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)

export default function PayrollPeriodCreatePage() {
  const navigate = useNavigate()
  const today = new Date()
  const [values, setValues] = useState(() => {
    const year = today.getFullYear()
    const month = today.getMonth() + 1
    return { year, month, paymentDate: suggestPaymentDate(year, month) }
  })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 연·월을 바꾸면 그 달 25일을 지급일로 제안한다. (직접 수정 가능)
  function handleYearMonthChange(event) {
    const { name, value } = event.target
    setValues((prev) => {
      const next = { ...prev, [name]: Number(value) }
      return { ...next, paymentDate: suggestPaymentDate(next.year, next.month) }
    })
    setErrors({})
  }

  function handlePaymentDateChange(event) {
    const paymentDate = event.target.value
    setValues((prev) => ({ ...prev, paymentDate }))
    setErrors((prev) => ({ ...prev, paymentDate: undefined }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')

    const nextErrors = validatePeriod(values)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      setFormError('입력값을 확인해 주세요.')
      return
    }

    setSubmitting(true)
    try {
      const created = await createPayrollPeriod(values)
      navigate(`/payroll/${created.id}`, {
        state: { notice: `${formatYearMonth(created.year, created.month)} 급여 기간을 만들었습니다.` },
      })
    } catch (error) {
      // 같은 연월(409)은 월 칸 아래에 표시한다.
      const fieldErrors = error.status === 409 ? { month: error.message } : error.fieldErrors ?? {}
      setErrors(fieldErrors)
      setFormError(error.message || '저장 중 오류가 발생했습니다.')
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: '급여 관리', to: '/payroll' }, { label: '급여 기간 만들기' }]}
        title="급여 기간 만들기"
        description="귀속 연월과 지급일을 정합니다. 같은 연월의 급여 기간은 하나만 만들 수 있습니다."
      />

      <SimulationNotice />

      <form className="card form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="alert alert--error" role="alert">
            {formError}
          </div>
        )}

        <section className="form-section">
          <h2 className="form-section__title">기본 정보</h2>
          <div className="form-grid">
            <div className={`form-field${errors.year ? ' form-field--error' : ''}`}>
              <label htmlFor="year" className="form-field__label">
                귀속 연도<span className="form-field__required" aria-label="필수">*</span>
              </label>
              <select id="year" name="year" className="input" value={values.year} onChange={handleYearMonthChange}>
                {yearOptions(today).map((year) => (
                  <option key={year} value={year}>
                    {year}년
                  </option>
                ))}
              </select>
              {errors.year && <p className="form-field__error">{errors.year}</p>}
            </div>

            <div className={`form-field${errors.month ? ' form-field--error' : ''}`}>
              <label htmlFor="month" className="form-field__label">
                귀속 월<span className="form-field__required" aria-label="필수">*</span>
              </label>
              <select id="month" name="month" className="input" value={values.month} onChange={handleYearMonthChange}>
                {MONTHS.map((month) => (
                  <option key={month} value={month}>
                    {month}월
                  </option>
                ))}
              </select>
              {errors.month && (
                <p className="form-field__error" role="alert">
                  {errors.month}
                </p>
              )}
            </div>

            <div className={`form-field${errors.paymentDate ? ' form-field--error' : ''}`}>
              <label htmlFor="paymentDate" className="form-field__label">
                지급일<span className="form-field__required" aria-label="필수">*</span>
              </label>
              <input
                id="paymentDate"
                name="paymentDate"
                type="date"
                className="input"
                value={values.paymentDate}
                onChange={handlePaymentDateChange}
                aria-invalid={Boolean(errors.paymentDate)}
              />
              {errors.paymentDate ? (
                <p className="form-field__error">{errors.paymentDate}</p>
              ) : (
                <p className="form-field__hint">연·월을 바꾸면 그 달 25일로 자동 제안합니다. 직접 수정할 수 있습니다.</p>
              )}
            </div>
          </div>
        </section>

        <div className="form-actions">
          <button type="button" className="button button--ghost" onClick={() => navigate('/payroll')} disabled={submitting}>
            취소
          </button>
          <button type="submit" className="button button--primary" disabled={submitting}>
            {submitting ? '만드는 중…' : '만들기'}
          </button>
        </div>
      </form>
    </>
  )
}
