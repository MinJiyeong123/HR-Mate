import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getAnnualPayrollSummary } from '../api/payrollApi'
import PageHeader from '../components/layout/PageHeader'
import AnnualBasisNotice from '../components/payroll/AnnualBasisNotice'
import AnnualYearSelect from '../components/payroll/AnnualYearSelect'
import SimulationNotice from '../components/payroll/SimulationNotice'
import { formatWon } from '../utils/format'

const COLUMN_COUNT = 10

function display(value) {
  return value ?? '-'
}

/** 연도 오류(400)는 서버의 fieldErrors.year 문구를 보여준다. */
function toErrorMessage(error) {
  return error.fieldErrors?.year ?? error.message ?? '연간 급여 집계를 불러오지 못했습니다.'
}

/** 연간 급여 집계 (포트폴리오용 시뮬레이션, 조회만) */
export default function AnnualPayrollSummaryPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const year = searchParams.get('year') ?? String(new Date().getFullYear())
  const [reloadKey, setReloadKey] = useState(0)
  const requestKey = `${year}#${reloadKey}`
  // 응답을 요청 키와 함께 저장해, 연도를 바꾸면 새 응답이 올 때까지 "불러오는 중"으로 보인다.
  const [result, setResult] = useState({ key: null, data: null, error: '' })

  useEffect(() => {
    let ignore = false
    getAnnualPayrollSummary(year)
      .then((data) => {
        if (!ignore) setResult({ key: requestKey, data, error: '' })
      })
      .catch((error) => {
        if (!ignore) setResult({ key: requestKey, data: null, error: toErrorMessage(error) })
      })
    return () => {
      ignore = true
    }
  }, [year, requestKey])

  const loading = result.key !== requestKey
  const summary = loading ? null : result.data
  const error = loading ? '' : result.error
  const employees = summary?.employees ?? []
  const totals = summary?.totals
  const employeePath = (employeeId) => `/payroll/annual/employees/${employeeId}?year=${encodeURIComponent(year)}`

  function statValue(value) {
    return loading || error ? '–' : value
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: '급여 관리', to: '/payroll' }, { label: '연간 급여 집계' }]}
        title="연간 급여 집계"
        description="귀속 연도별로 확정된 급여를 합산합니다. 행을 누르면 사원별 월별 내역으로 이동합니다."
        actions={<AnnualYearSelect value={year} onChange={(next) => setSearchParams({ year: next })} />}
      />

      <SimulationNotice />
      <AnnualBasisNotice
        excludedMessage={
          summary?.excludedDraftPeriodCount > 0 && (
            <>
              작성 중인 급여 기간 {summary.excludedDraftPeriodCount}개는 합계에서 제외되었습니다. 확정하면 집계에
              포함됩니다. <Link to="/payroll">급여 관리로 이동</Link>
            </>
          )
        }
      />

      <div className="stats stats--four">
        <div className="stat-card">
          <span className="stat-card__label">인원 · 확정 기간</span>
          <strong className="stat-card__value">
            {statValue(`${employees.length}명`)}
          </strong>
          <span className="stat-card__sub">확정 기간 {statValue(`${summary?.confirmedPeriodCount ?? 0}개`)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">지급 합계</span>
          <strong className="stat-card__value stat-card__value--money">{statValue(formatWon(totals?.totalEarnings))}</strong>
          <span className="stat-card__sub">
            과세 {statValue(formatWon(totals?.taxableEarnings))} · 비과세 {statValue(formatWon(totals?.nonTaxableEarnings))}
          </span>
        </div>
        <div className="stat-card stat-card--resigned">
          <span className="stat-card__label">공제 합계</span>
          <strong className="stat-card__value stat-card__value--money">{statValue(formatWon(totals?.totalDeductions))}</strong>
        </div>
        <div className="stat-card stat-card--active">
          <span className="stat-card__label">실지급 합계</span>
          <strong className="stat-card__value stat-card__value--money">{statValue(formatWon(totals?.netPay))}</strong>
        </div>
      </div>

      <section className="card">
        <div className="card__header">
          <h2 className="card__title">사원별 연간 합계</h2>
          <span className="card__meta">사번 순 · 사원 정보는 그 해 마지막 확정 급여 기준</span>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">사번</th>
                <th scope="col">이름</th>
                <th scope="col">부서</th>
                <th scope="col">직급</th>
                <th scope="col" className="table__number">개월</th>
                <th scope="col" className="table__number">지급</th>
                <th scope="col" className="table__number">과세</th>
                <th scope="col" className="table__number">비과세</th>
                <th scope="col" className="table__number">공제</th>
                <th scope="col" className="table__number">실지급</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={COLUMN_COUNT} className="table__empty">
                    불러오는 중…
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={COLUMN_COUNT} className="table__empty table__empty--error">
                    <p>{error}</p>
                    <button
                      type="button"
                      className="button button--secondary table__retry"
                      onClick={() => setReloadKey((key) => key + 1)}
                    >
                      다시 시도
                    </button>
                  </td>
                </tr>
              )}
              {!loading && !error && employees.length === 0 && (
                <tr>
                  <td colSpan={COLUMN_COUNT} className="table__empty">
                    <p>{year}년에 확정된 급여가 없습니다.</p>
                    <Link to="/payroll" className="button button--secondary table__retry">
                      급여 관리로 이동
                    </Link>
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                employees.map((employee) => (
                  <tr
                    key={employee.employeeId}
                    className="table__row--link"
                    onClick={() => navigate(employeePath(employee.employeeId))}
                  >
                    <td className="table__mono">{employee.employeeNo}</td>
                    <td className="table__strong">
                      <Link
                        to={employeePath(employee.employeeId)}
                        className="table__link"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {employee.employeeName}
                      </Link>
                      {employee.deleted && <span className="badge badge--deleted">삭제됨</span>}
                    </td>
                    <td>{display(employee.department)}</td>
                    <td>{display(employee.position)}</td>
                    <td className="table__number">{employee.payrollCount}</td>
                    <td className="table__number">{formatWon(employee.totals.totalEarnings)}</td>
                    <td className="table__number">{formatWon(employee.totals.taxableEarnings)}</td>
                    <td className="table__number">{formatWon(employee.totals.nonTaxableEarnings)}</td>
                    <td className="table__number">{formatWon(employee.totals.totalDeductions)}</td>
                    <td className="table__number table__strong">{formatWon(employee.totals.netPay)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
