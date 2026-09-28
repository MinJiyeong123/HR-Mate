import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { deletePayroll, getPayroll } from '../api/payrollApi'
import ConfirmDialog from '../components/common/ConfirmDialog'
import PageHeader from '../components/layout/PageHeader'
import PayrollStatusBadge from '../components/payroll/PayrollStatusBadge'
import { PAYROLL_STATUS } from '../constants/payrollStatus'
import { formatWon, formatYearMonth } from '../utils/format'

const COMPANY_NAME = 'HR Mate (가상 회사)'
const TAX_LABEL = { TAXABLE: '과세', NON_TAXABLE: '비과세' }

function display(value) {
  return value ?? '-'
}

function LineTable({ title, lines, totalLabel, total, showTax }) {
  return (
    <div className="payslip__column">
      <h2 className="payslip__column-title">{title}</h2>
      <table className="payslip__table">
        <tbody>
          {lines.length === 0 && (
            <tr>
              <td colSpan={2} className="payslip__empty">
                없음
              </td>
            </tr>
          )}
          {lines.map((line) => (
            <tr key={line.payItemId}>
              <th scope="row">
                {line.itemName}
                {showTax && TAX_LABEL[line.taxType] && (
                  <span className="payslip__tax"> ({TAX_LABEL[line.taxType]})</span>
                )}
              </th>
              <td>{formatWon(line.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{totalLabel}</th>
            <td>{formatWon(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/** 급여명세서 (포트폴리오용 시뮬레이션) - 보기, 삭제, 인쇄 */
export default function PayslipPage() {
  const { payrollId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [payroll, setPayroll] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState(location.state?.notice ?? '')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    // 새로고침했을 때 완료 메시지가 다시 뜨지 않도록 주소의 상태 값을 비운다.
    if (location.state?.notice) navigate(location.pathname, { replace: true, state: null })
  }, [location, navigate])

  useEffect(() => {
    let ignore = false
    getPayroll(payrollId)
      .then((data) => {
        if (!ignore) setPayroll(data)
      })
      .catch((error) => {
        if (!ignore) setLoadError(error.message || '급여명세서를 불러오지 못했습니다.')
      })
    return () => {
      ignore = true
    }
  }, [payrollId])

  async function handleDelete() {
    setDeleting(true)
    setDeleteError('')
    try {
      await deletePayroll(payrollId)
      navigate(`/payroll/${payroll.period.id}`, {
        state: { notice: `${payroll.employeeName}(${payroll.employeeNo}) 사원의 급여를 삭제했습니다.` },
      })
    } catch (error) {
      setDeleting(false)
      setConfirmOpen(false)
      setDeleteError(error.message || '삭제하지 못했습니다.')
    }
  }

  if (loadError || !payroll) {
    return (
      <>
        <PageHeader breadcrumbs={[{ label: '급여 관리', to: '/payroll' }, { label: '급여명세서' }]} title="급여명세서" />
        <div className="card empty-state">
          <p>{loadError || '불러오는 중…'}</p>
          {loadError && (
            <Link to="/payroll" className="button button--secondary">
              급여 기간 목록으로
            </Link>
          )}
        </div>
      </>
    )
  }

  const { period } = payroll
  const periodLabel = formatYearMonth(period.year, period.month)
  const editable = period.status !== PAYROLL_STATUS.CONFIRMED

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: '급여 관리', to: '/payroll' },
          { label: periodLabel, to: `/payroll/${period.id}` },
          { label: '급여명세서' },
        ]}
        title={`급여명세서 · ${payroll.employeeName}`}
        description={
          editable
            ? '작성 중인 급여입니다. 수정하거나 삭제할 수 있습니다.'
            : '확정된 급여입니다. 수정하려면 급여 기간의 확정을 취소해 주세요.'
        }
        actions={
          <>
            <Link to={`/payroll/${period.id}`} className="button button--ghost">
              기간으로
            </Link>
            {editable && (
              <>
                <Link to={`/payroll/${period.id}/payrolls/${payroll.id}/edit`} className="button">
                  수정
                </Link>
                <button type="button" className="button button--danger-outline" onClick={() => setConfirmOpen(true)}>
                  삭제
                </button>
              </>
            )}
            <button type="button" className="button button--primary" onClick={() => window.print()}>
              인쇄
            </button>
          </>
        }
      />

      {notice && (
        <div className="alert alert--success" role="status">
          <span>{notice}</span>
          <button type="button" className="alert__close" onClick={() => setNotice('')} aria-label="알림 닫기">
            ×
          </button>
        </div>
      )}
      {deleteError && (
        <div className="alert alert--error" role="alert">
          {deleteError}
        </div>
      )}

      <article className="card payslip">
        <header className="payslip__header">
          <h1 className="payslip__title">
            급여명세서 <span className="payslip__title-sub">(시뮬레이션)</span>
          </h1>
          <div className="payslip__meta">
            <span>{COMPANY_NAME}</span>
            <span>
              귀속 {periodLabel} · 지급일 <span className="table__mono">{period.paymentDate}</span>
            </span>
          </div>
        </header>

        <dl className="payslip__employee">
          <div>
            <dt>사번</dt>
            <dd className="table__mono">{payroll.employeeNo}</dd>
          </div>
          <div>
            <dt>이름</dt>
            <dd>{payroll.employeeName}</dd>
          </div>
          <div>
            <dt>부서</dt>
            <dd>{display(payroll.department)}</dd>
          </div>
          <div>
            <dt>직급</dt>
            <dd>{display(payroll.position)}</dd>
          </div>
          <div>
            <dt>상태</dt>
            <dd>
              <PayrollStatusBadge status={period.status} />
            </dd>
          </div>
        </dl>

        <div className="payslip__columns">
          <LineTable title="지급 내역" lines={payroll.earnings} totalLabel="지급 합계" total={payroll.totalEarnings} showTax />
          <LineTable title="공제 내역" lines={payroll.deductions} totalLabel="공제 합계" total={payroll.totalDeductions} />
        </div>

        <div className="payslip__net">
          <span>실지급액</span>
          <strong>{formatWon(payroll.netPay)}</strong>
        </div>

        {payroll.memo && <p className="payslip__memo">메모: {payroll.memo}</p>}

        <p className="payslip__notice">
          ※ 포트폴리오용 시뮬레이션입니다. 금액은 직접 입력한 값이며 소득세·지방소득세·4대보험료를 자동 계산하지
          않았습니다. 실제 급여명세서나 세금 산출 결과가 아닙니다. 사원 정보는 급여 입력 당시 기준입니다.
        </p>
      </article>

      <ConfirmDialog
        open={confirmOpen}
        title="급여를 삭제할까요?"
        confirmLabel="삭제"
        tone="danger"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      >
        <p>
          <strong>
            {payroll.employeeName} ({payroll.employeeNo})
          </strong>{' '}
          사원의 {periodLabel} 급여를 삭제합니다.
        </p>
        <ul className="dialog__list">
          <li>작성 중인 급여만 삭제할 수 있으며, 삭제하면 되돌릴 수 없습니다.</li>
          <li>삭제 후 같은 사원의 급여를 다시 입력할 수 있습니다.</li>
        </ul>
      </ConfirmDialog>
    </>
  )
}
