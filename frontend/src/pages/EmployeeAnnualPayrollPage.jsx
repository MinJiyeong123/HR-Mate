import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getEmployeeAnnualPayroll } from '../api/payrollApi'
import PageHeader from '../components/layout/PageHeader'
import AnnualBasisNotice from '../components/payroll/AnnualBasisNotice'
import AnnualYearSelect from '../components/payroll/AnnualYearSelect'
import SimulationNotice from '../components/payroll/SimulationNotice'
import { formatWon } from '../utils/format'

const CATEGORY_LABEL = { EARNING: '지급', DEDUCTION: '공제' }
const TAX_LABEL = { TAXABLE: '과세', NON_TAXABLE: '비과세', NONE: '-' }

function display(value) {
  return value ?? '-'
}

function toErrorMessage(error) {
  return error.fieldErrors?.year ?? error.message ?? '연간 급여 내역을 불러오지 못했습니다.'
}

/** 지급일이 귀속 연도보다 뒤의 해인지 ("2027-01-10", "2026" → true) */
function paidInLaterYear(paymentDate, year) {
  return Number(paymentDate?.slice(0, 4)) > Number(year)
}

/** 사원별 연간 급여 상세 (포트폴리오용 시뮬레이션, 조회만) */
export default function EmployeeAnnualPayrollPage() {
  const { employeeId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const year = searchParams.get('year') ?? String(new Date().getFullYear())
  const [reloadKey, setReloadKey] = useState(0)
  const requestKey = `${employeeId}#${year}#${reloadKey}`
  const [result, setResult] = useState({ key: null, data: null, error: '' })

  useEffect(() => {
    let ignore = false
    getEmployeeAnnualPayroll(employeeId, year)
      .then((data) => {
        if (!ignore) setResult({ key: requestKey, data, error: '' })
      })
      .catch((error) => {
        if (!ignore) setResult({ key: requestKey, data: null, error: toErrorMessage(error) })
      })
    return () => {
      ignore = true
    }
  }, [employeeId, year, requestKey])

  const loading = result.key !== requestKey
  const detail = loading ? null : result.data
  const error = loading ? '' : result.error
  const summaryPath = `/payroll/annual?year=${encodeURIComponent(year)}`
  const yearSelect = <AnnualYearSelect value={year} onChange={(next) => setSearchParams({ year: next })} />
  const breadcrumbs = [
    { label: '급여 관리', to: '/payroll' },
    { label: '연간 급여 집계', to: summaryPath },
    { label: '사원별 연간 내역' },
  ]

  if (loading || error) {
    return (
      <>
        <PageHeader breadcrumbs={breadcrumbs} title="사원별 연간 급여" actions={yearSelect} />
        <div className="card empty-state">
          <p className={error ? 'form-field__error' : undefined}>{error || '불러오는 중…'}</p>
          {error && (
            <div className="empty-state__actions">
              <button type="button" className="button button--secondary" onClick={() => setReloadKey((key) => key + 1)}>
                다시 시도
              </button>
              <Link to={summaryPath} className="button button--secondary">
                연간 급여 집계로
              </Link>
            </div>
          )}
        </div>
      </>
    )
  }

  const { totals, months, items } = detail

  return (
    <>
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={
          <span className="page-header__title-with-badge">
            {detail.employeeName} · {year}년
            {detail.deleted && <span className="badge badge--deleted">삭제됨</span>}
          </span>
        }
        description={`사번 ${detail.employeeNo} · ${display(detail.department)} · ${display(detail.position)} (그 해 마지막 확정 급여 기준, 확정 급여가 없으면 현재 사원 정보)`}
        actions={
          <>
            <Link to={summaryPath} className="button button--ghost">
              연간 집계로
            </Link>
            {yearSelect}
          </>
        }
      />

      <SimulationNotice />
      <AnnualBasisNotice
        excludedMessage={
          detail.excludedDraftPayrollCount > 0 &&
          `이 사원의 작성 중인 급여 ${detail.excludedDraftPayrollCount}건은 합계에서 제외되었습니다. 급여 기간을 확정하면 집계에 포함됩니다.`
        }
      />

      <div className="stats stats--four">
        <div className="stat-card">
          <span className="stat-card__label">확정 급여</span>
          <strong className="stat-card__value">{months.length}개월</strong>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">지급 합계</span>
          <strong className="stat-card__value stat-card__value--money">{formatWon(totals.totalEarnings)}</strong>
          <span className="stat-card__sub">
            과세 {formatWon(totals.taxableEarnings)} · 비과세 {formatWon(totals.nonTaxableEarnings)}
          </span>
        </div>
        <div className="stat-card stat-card--resigned">
          <span className="stat-card__label">공제 합계</span>
          <strong className="stat-card__value stat-card__value--money">{formatWon(totals.totalDeductions)}</strong>
        </div>
        <div className="stat-card stat-card--active">
          <span className="stat-card__label">실지급 합계</span>
          <strong className="stat-card__value stat-card__value--money">{formatWon(totals.netPay)}</strong>
        </div>
      </div>

      <section className="card">
        <div className="card__header">
          <h2 className="card__title">월별 내역</h2>
          <span className="card__meta">귀속 월 순 · 확정된 급여만</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">귀속 월</th>
                <th scope="col">지급일</th>
                <th scope="col" className="table__number">지급</th>
                <th scope="col" className="table__number">과세</th>
                <th scope="col" className="table__number">비과세</th>
                <th scope="col" className="table__number">공제</th>
                <th scope="col" className="table__number">실지급</th>
                <th scope="col" className="table__actions">명세서</th>
              </tr>
            </thead>
            <tbody>
              {months.length === 0 && (
                <tr>
                  <td colSpan={8} className="table__empty">
                    {year}년에 확정된 급여가 없습니다.
                  </td>
                </tr>
              )}
              {months.map((month) => (
                <tr key={month.payrollId}>
                  <td className="table__strong">{month.month}월</td>
                  <td className="table__mono">
                    {month.paymentDate}
                    {paidInLaterYear(month.paymentDate, year) && <span className="table__note">다음 해 지급</span>}
                  </td>
                  <td className="table__number">{formatWon(month.totalEarnings)}</td>
                  <td className="table__number">{formatWon(month.taxableEarnings)}</td>
                  <td className="table__number">{formatWon(month.nonTaxableEarnings)}</td>
                  <td className="table__number">{formatWon(month.totalDeductions)}</td>
                  <td className="table__number table__strong">{formatWon(month.netPay)}</td>
                  <td className="table__actions">
                    <Link to={`/payrolls/${month.payrollId}`} className="table__link">
                      보기
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
            {months.length > 0 && (
              <tfoot>
                <tr>
                  <th scope="row" colSpan={2}>
                    연간 합계
                  </th>
                  <td className="table__number">{formatWon(totals.totalEarnings)}</td>
                  <td className="table__number">{formatWon(totals.taxableEarnings)}</td>
                  <td className="table__number">{formatWon(totals.nonTaxableEarnings)}</td>
                  <td className="table__number">{formatWon(totals.totalDeductions)}</td>
                  <td className="table__number">{formatWon(totals.netPay)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <section className="card annual-section">
        <div className="card__header">
          <h2 className="card__title">항목별 연간 합계</h2>
          <span className="card__meta">항목 표시 순서 · 비과세 한도 검사 없음</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">항목</th>
                <th scope="col">구분</th>
                <th scope="col">과세 구분</th>
                <th scope="col" className="table__number">연간 금액</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="table__empty">
                    합산할 항목이 없습니다.
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.payItemId}>
                  <td className="table__strong">{item.itemName}</td>
                  <td>{CATEGORY_LABEL[item.category] ?? item.category}</td>
                  <td>{TAX_LABEL[item.taxType] ?? item.taxType}</td>
                  <td className="table__number">{formatWon(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
