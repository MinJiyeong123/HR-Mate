import { useState } from 'react'
import { formatWon } from '../../utils/format'
import { MEMO_MAX_LENGTH, sumPayroll, validatePayroll } from '../../utils/payrollValidation'
import AmountInput from './AmountInput'

const TAX_LABEL = { TAXABLE: '과세', NON_TAXABLE: '비과세' }

function display(value) {
  return value ?? '-'
}

/**
 * 급여 입력·수정 공용 폼 (포트폴리오용 시뮬레이션)
 * - mode: 'create' | 'edit'
 * - items: 지급·공제 항목 (표시 순서)
 * - employees: 입력 가능한 사원 (create 에서만)
 * - employeeInfo: 입력 당시 사원 정보 (edit 에서만, 읽기 전용)
 * - initialAmounts: { payItemId: 금액 문자열 }, initialMemo
 * - onSubmit({ employeeId, lines, memo }): 실패 시 { message, fieldErrors } 오류를 던진다.
 */
export default function PayrollForm({
  mode,
  items,
  employees = [],
  employeeInfo,
  initialAmounts = {},
  initialMemo = '',
  onSubmit,
  onCancel,
}) {
  const isCreate = mode === 'create'
  const [employeeId, setEmployeeId] = useState('')
  const [amounts, setAmounts] = useState(initialAmounts)
  const [memo, setMemo] = useState(initialMemo ?? '')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const earningItems = items.filter((item) => item.category === 'EARNING')
  const deductionItems = items.filter((item) => item.category === 'DEDUCTION')
  const totals = sumPayroll(items, amounts)
  const overDeducted = totals.deductions > totals.earnings

  function clearError(...keys) {
    setErrors((prev) => {
      if (!keys.some((key) => prev[key])) return prev
      const next = { ...prev }
      keys.forEach((key) => delete next[key])
      return next
    })
  }

  function handleAmountChange(itemId, value) {
    setAmounts((prev) => ({ ...prev, [itemId]: value }))
    clearError(itemId, 'lines')
  }

  /** 서버 fieldErrors 를 화면 칸에 연결한다. lines[3].amount → 보낸 순서 3번째 항목 */
  function mapServerErrors(fieldErrors = {}) {
    const mapped = {}
    for (const [key, message] of Object.entries(fieldErrors)) {
      const match = key.match(/^lines\[(\d+)\]/)
      if (match && items[Number(match[1])]) mapped[items[Number(match[1])].id] = message
      else mapped[key] = message
    }
    return mapped
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')

    const nextErrors = validatePayroll({ employeeId, amounts, memo }, items, { requireEmployee: isCreate })
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      setFormError('입력값을 확인해 주세요.')
      return
    }

    setSubmitting(true)
    try {
      // 모든 항목을 표시 순서대로 보낸다. 0원 항목은 서버가 저장하지 않는다.
      const lines = items.map((item) => ({ payItemId: item.id, amount: Number(amounts[item.id] || 0) }))
      await onSubmit({ employeeId: isCreate ? Number(employeeId) : undefined, lines, memo: memo.trim() || null })
    } catch (error) {
      setErrors(mapServerErrors(error.fieldErrors))
      setFormError(error.message || '저장 중 오류가 발생했습니다.')
      setSubmitting(false)
    }
  }

  function renderItems(list) {
    return list.map((item) => {
      const inputId = `amount-${item.id}`
      return (
        <div key={item.id} className={`amount-row${errors[item.id] ? ' amount-row--error' : ''}`}>
          <label htmlFor={inputId} className="amount-row__label">
            {item.name}
            {TAX_LABEL[item.taxType] && (
              <span className={`tax-tag tax-tag--${item.taxType === 'NON_TAXABLE' ? 'free' : 'taxable'}`}>
                {TAX_LABEL[item.taxType]}
              </span>
            )}
          </label>
          <AmountInput
            id={inputId}
            value={amounts[item.id] ?? ''}
            onChange={(value) => handleAmountChange(item.id, value)}
            invalid={Boolean(errors[item.id])}
            describedBy={errors[item.id] ? `${inputId}-error` : undefined}
            disabled={submitting}
          />
          {errors[item.id] && (
            <p id={`${inputId}-error`} className="form-field__error amount-row__error">
              {errors[item.id]}
            </p>
          )}
        </div>
      )
    })
  }

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      {formError && (
        <div className="alert alert--error" role="alert">
          {formError}
        </div>
      )}

      <section className="form-section">
        <h2 className="form-section__title">대상 사원</h2>
        {isCreate ? (
          <div className={`form-field${errors.employeeId ? ' form-field--error' : ''}`}>
            <label htmlFor="employeeId" className="form-field__label">
              사원<span className="form-field__required" aria-label="필수">*</span>
            </label>
            <select
              id="employeeId"
              className="input"
              value={employeeId}
              onChange={(event) => {
                setEmployeeId(event.target.value)
                clearError('employeeId')
              }}
              disabled={submitting}
            >
              <option value="">사원을 선택해 주세요</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.employeeNo} {employee.name}
                  {employee.department || employee.position
                    ? ` (${[employee.department, employee.position].filter(Boolean).join('·')})`
                    : ''}
                </option>
              ))}
            </select>
            {errors.employeeId ? (
              <p className="form-field__error">{errors.employeeId}</p>
            ) : (
              <p className="form-field__hint">이 달에 재직했고 아직 급여가 입력되지 않은 사원만 표시됩니다.</p>
            )}
          </div>
        ) : (
          <dl className="detail-grid detail-grid--four">
            <div className="detail-item">
              <dt className="detail-item__label">사번</dt>
              <dd className="detail-item__value table__mono">{employeeInfo.employeeNo}</dd>
            </div>
            <div className="detail-item">
              <dt className="detail-item__label">이름</dt>
              <dd className="detail-item__value">{employeeInfo.employeeName}</dd>
            </div>
            <div className="detail-item">
              <dt className="detail-item__label">부서</dt>
              <dd className="detail-item__value">{display(employeeInfo.department)}</dd>
            </div>
            <div className="detail-item">
              <dt className="detail-item__label">직급</dt>
              <dd className="detail-item__value">{display(employeeInfo.position)}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="form-section">
        <div className="amount-columns">
          <div>
            <h2 className="form-section__title">지급 항목</h2>
            {renderItems(earningItems)}
          </div>
          <div>
            <h2 className="form-section__title">
              공제 항목 <span className="form-section__sub">직접 입력 · 자동 계산 없음</span>
            </h2>
            {renderItems(deductionItems)}
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section__title">
          합계 미리보기 <span className="form-section__sub">저장할 때 서버가 다시 계산합니다</span>
        </h2>
        <div className={`totals${overDeducted ? ' totals--error' : ''}`} aria-live="polite">
          <span>
            지급 합계 <strong>{formatWon(totals.earnings)}</strong>
          </span>
          <span aria-hidden="true">−</span>
          <span>
            공제 합계 <strong>{formatWon(totals.deductions)}</strong>
          </span>
          <span aria-hidden="true">=</span>
          <span className="totals__net">
            실지급액 <strong>{formatWon(totals.netPay)}</strong>
          </span>
        </div>
        {(errors.lines || overDeducted) && (
          <p className="form-field__error totals__error" role="alert">
            {errors.lines ?? '공제 합계가 지급 합계보다 클 수 없습니다.'}
          </p>
        )}
      </section>

      <section className="form-section">
        <div className={`form-field${errors.memo ? ' form-field--error' : ''}`}>
          <label htmlFor="memo" className="form-field__label">
            메모
          </label>
          <input
            id="memo"
            className="input"
            value={memo}
            maxLength={MEMO_MAX_LENGTH}
            onChange={(event) => {
              setMemo(event.target.value)
              clearError('memo')
            }}
            placeholder="예: 4월 정기 급여"
            disabled={submitting}
          />
          {errors.memo ? (
            <p className="form-field__error">{errors.memo}</p>
          ) : (
            <p className="form-field__hint">{MEMO_MAX_LENGTH}자 이하</p>
          )}
        </div>
      </section>

      <div className="form-actions">
        <button type="button" className="button button--ghost" onClick={onCancel} disabled={submitting}>
          취소
        </button>
        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting ? '저장 중…' : '저장'}
        </button>
      </div>
    </form>
  )
}
