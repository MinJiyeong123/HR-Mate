import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  confirmPayrollPeriod,
  getPayrollPeriod,
  reopenPayrollPeriod,
  updatePayrollPeriod,
} from '../api/payrollApi'
import ConfirmDialog from '../components/common/ConfirmDialog'
import PageHeader from '../components/layout/PageHeader'
import PayrollStatusBadge from '../components/payroll/PayrollStatusBadge'
import SimulationNotice from '../components/payroll/SimulationNotice'
import { PAYROLL_STATUS } from '../constants/payrollStatus'
import { formatDateTime, formatWon, formatYearMonth } from '../utils/format'

function display(value) {
  return value ?? '-'
}

export default function PayrollPeriodDetailPage() {
  const { periodId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [period, setPeriod] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [notice, setNotice] = useState(location.state?.notice ?? '')
  const [actionError, setActionError] = useState('')

  // 지급일 수정
  const [editingDate, setEditingDate] = useState(false)
  const [paymentDate, setPaymentDate] = useState('')
  const [savingDate, setSavingDate] = useState(false)

  // 확정·확정 취소 확인창: 'confirm' | 'reopen' | null
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // 새로고침했을 때 완료 메시지가 다시 뜨지 않도록 주소의 상태 값을 비운다.
    if (location.state?.notice) navigate(location.pathname, { replace: true, state: null })
  }, [location, navigate])

  useEffect(() => {
    let ignore = false
    getPayrollPeriod(periodId)
      .then((data) => {
        if (!ignore) {
          setPeriod(data)
          setLoadError('')
        }
      })
      .catch((error) => {
        if (!ignore) setLoadError(error.message || '급여 기간을 불러오지 못했습니다.')
      })
    return () => {
      ignore = true
    }
  }, [periodId, reloadKey])

  function reload() {
    setReloadKey((key) => key + 1)
  }

  function startEditDate() {
    setPaymentDate(period.paymentDate)
    setActionError('')
    setNotice('')
    setEditingDate(true)
  }

  async function saveDate(event) {
    event.preventDefault()
    if (!paymentDate) {
      setActionError('지급일을 입력해 주세요.')
      return
    }
    setSavingDate(true)
    try {
      await updatePayrollPeriod(periodId, { paymentDate })
      setEditingDate(false)
      setNotice('지급일을 수정했습니다.')
      setActionError('')
      reload()
    } catch (error) {
      setActionError(error.message || '지급일을 수정하지 못했습니다.')
    } finally {
      setSavingDate(false)
    }
  }

  async function handleDialogConfirm() {
    const action = dialog
    setBusy(true)
    setActionError('')
    setNotice('')
    try {
      if (action === 'confirm') {
        await confirmPayrollPeriod(periodId)
        setNotice('급여 기간을 확정했습니다. 확정된 기간은 수정할 수 없습니다.')
      } else {
        await reopenPayrollPeriod(periodId)
        setNotice('확정을 취소했습니다. 다시 수정할 수 있습니다.')
      }
      reload()
    } catch (error) {
      setActionError(error.message || '처리하지 못했습니다.')
    } finally {
      setBusy(false)
      setDialog(null)
    }
  }

  const breadcrumbs = [
    { label: '급여 관리', to: '/payroll' },
    { label: period ? formatYearMonth(period.year, period.month) : '급여 기간 상세' },
  ]

  if (loadError) {
    return (
      <>
        <PageHeader breadcrumbs={breadcrumbs} title="급여 기간 상세" />
        <div className="card empty-state">
          <p>{loadError}</p>
          <div className="empty-state__actions">
            <button type="button" className="button button--ghost" onClick={reload}>
              다시 시도
            </button>
            <Link to="/payroll" className="button button--secondary">
              급여 기간 목록으로
            </Link>
          </div>
        </div>
      </>
    )
  }

  if (!period) {
    return (
      <>
        <PageHeader breadcrumbs={breadcrumbs} title="급여 기간 상세" />
        <div className="card empty-state">불러오는 중…</div>
      </>
    )
  }

  const confirmed = period.status === PAYROLL_STATUS.CONFIRMED
  const title = `${formatYearMonth(period.year, period.month)} 급여`

  return (
    <>
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={
          <span className="page-header__title-with-badge">
            {title} <PayrollStatusBadge status={period.status} />
          </span>
        }
        description={
          confirmed
            ? '확정된 급여 기간입니다. 수정하려면 확정을 취소해 주세요.'
            : '작성 중인 급여 기간입니다. 급여를 입력한 뒤 확정합니다.'
        }
        actions={
          <>
            <Link to="/payroll" className="button button--ghost">
              목록
            </Link>
            {confirmed ? (
              <button type="button" className="button button--secondary" onClick={() => setDialog('reopen')}>
                확정 취소
              </button>
            ) : (
              <button type="button" className="button button--primary" onClick={() => setDialog('confirm')}>
                확정
              </button>
            )}
          </>
        }
      />

      <SimulationNotice />

      {notice && (
        <div className="alert alert--success" role="status">
          <span>{notice}</span>
          <button type="button" className="alert__close" onClick={() => setNotice('')} aria-label="알림 닫기">
            ×
          </button>
        </div>
      )}
      {actionError && (
        <div className="alert alert--error" role="alert">
          {actionError}
        </div>
      )}

      <div className="stats stats--four">
        <div className="stat-card">
          <span className="stat-card__label">인원</span>
          <strong className="stat-card__value">{period.payrollCount}명</strong>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">지급 합계</span>
          <strong className="stat-card__value stat-card__value--money">{formatWon(period.totalEarnings)}</strong>
        </div>
        <div className="stat-card stat-card--resigned">
          <span className="stat-card__label">공제 합계</span>
          <strong className="stat-card__value stat-card__value--money">{formatWon(period.totalDeductions)}</strong>
        </div>
        <div className="stat-card stat-card--active">
          <span className="stat-card__label">실지급 합계</span>
          <strong className="stat-card__value stat-card__value--money">{formatWon(period.totalNetPay)}</strong>
        </div>
      </div>

      <section className="card detail-card">
        <h2 className="form-section__title">기간 정보</h2>
        <dl className="detail-grid detail-grid--three">
          <div className="detail-item">
            <dt className="detail-item__label">귀속 연월</dt>
            <dd className="detail-item__value">{formatYearMonth(period.year, period.month)}</dd>
          </div>
          <div className="detail-item">
            <dt className="detail-item__label">지급일</dt>
            <dd className="detail-item__value">
              {editingDate ? (
                <form className="inline-form" onSubmit={saveDate}>
                  <input
                    type="date"
                    className="input input--compact"
                    value={paymentDate}
                    onChange={(event) => setPaymentDate(event.target.value)}
                    aria-label="지급일"
                  />
                  <button type="submit" className="button button--primary button--small" disabled={savingDate}>
                    {savingDate ? '저장 중…' : '저장'}
                  </button>
                  <button
                    type="button"
                    className="button button--ghost button--small"
                    onClick={() => setEditingDate(false)}
                    disabled={savingDate}
                  >
                    취소
                  </button>
                </form>
              ) : (
                <span className="inline-form">
                  <span className="table__mono">{period.paymentDate}</span>
                  {!confirmed && (
                    <button type="button" className="button button--small" onClick={startEditDate}>
                      지급일 수정
                    </button>
                  )}
                </span>
              )}
            </dd>
          </div>
          <div className="detail-item">
            <dt className="detail-item__label">확정 시각</dt>
            <dd className="detail-item__value table__mono">{formatDateTime(period.confirmedAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="card">
        <div className="card__header">
          <h2 className="card__title">사원별 급여</h2>
          <span className="card__meta">입력 당시 사원 정보 기준 · 사번 순</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">사번</th>
                <th scope="col">이름</th>
                <th scope="col">부서</th>
                <th scope="col">직급</th>
                <th scope="col" className="table__number">지급 합계</th>
                <th scope="col" className="table__number">공제 합계</th>
                <th scope="col" className="table__number">실지급액</th>
              </tr>
            </thead>
            <tbody>
              {period.payrolls.length === 0 && (
                <tr>
                  <td colSpan={7} className="table__empty">
                    <p>아직 입력된 급여가 없습니다.</p>
                    <p className="table__sub-note">급여 입력 화면은 다음 단계(2-5)에서 추가됩니다.</p>
                  </td>
                </tr>
              )}
              {period.payrolls.map((payroll) => (
                <tr key={payroll.id}>
                  <td className="table__mono">{payroll.employeeNo}</td>
                  <td className="table__strong">{payroll.employeeName}</td>
                  <td>{display(payroll.department)}</td>
                  <td>{display(payroll.position)}</td>
                  <td className="table__number">{formatWon(payroll.totalEarnings)}</td>
                  <td className="table__number">{formatWon(payroll.totalDeductions)}</td>
                  <td className="table__number table__strong">{formatWon(payroll.netPay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        open={dialog === 'confirm'}
        title={`${title}를 확정할까요?`}
        confirmLabel="확정"
        busy={busy}
        onConfirm={handleDialogConfirm}
        onCancel={() => setDialog(null)}
      >
        <ul className="dialog__list">
          <li>확정하면 급여 입력·수정·삭제와 지급일 수정을 할 수 없습니다.</li>
          <li>급여 내역이 1건 이상 있어야 확정할 수 있습니다.</li>
          <li>필요하면 확정을 취소하고 다시 수정할 수 있습니다.</li>
        </ul>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'reopen'}
        title={`${title} 확정을 취소할까요?`}
        confirmLabel="확정 취소"
        tone="danger"
        busy={busy}
        onConfirm={handleDialogConfirm}
        onCancel={() => setDialog(null)}
      >
        <ul className="dialog__list">
          <li>작성 중 상태로 돌아가 급여를 다시 수정할 수 있습니다.</li>
          <li>확정·취소 이력은 기록되지 않습니다.</li>
        </ul>
      </ConfirmDialog>
    </>
  )
}
