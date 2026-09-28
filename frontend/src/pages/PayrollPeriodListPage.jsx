import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getPayrollPeriods } from '../api/payrollApi'
import PageHeader from '../components/layout/PageHeader'
import PayrollStatusBadge from '../components/payroll/PayrollStatusBadge'
import SimulationNotice from '../components/payroll/SimulationNotice'
import { formatWon, formatYearMonth } from '../utils/format'

export default function PayrollPeriodListPage() {
  const navigate = useNavigate()
  const [periods, setPeriods] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let ignore = false
    getPayrollPeriods()
      .then((data) => {
        if (!ignore) setPeriods(data)
      })
      .catch((err) => {
        if (!ignore) setError(err.message || '급여 기간 목록을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [reloadKey])

  function handleRetry() {
    setLoading(true)
    setError('')
    setReloadKey((key) => key + 1)
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: '급여 관리' }, { label: '급여 기간 목록' }]}
        title="급여 관리"
        description="월별 급여 기간을 만들고 사원별 급여를 입력·확정합니다. 행을 누르면 상세 화면으로 이동합니다."
        actions={
          <Link to="/payroll/new" className="button button--primary">
            + 급여 기간 만들기
          </Link>
        }
      />

      <SimulationNotice />

      <section className="card">
        <div className="card__header">
          <h2 className="card__title">급여 기간</h2>
          <span className="card__meta">최신 연월부터</span>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">귀속 연월</th>
                <th scope="col">지급일</th>
                <th scope="col">상태</th>
                <th scope="col" className="table__number">인원</th>
                <th scope="col" className="table__number">지급 합계</th>
                <th scope="col" className="table__number">공제 합계</th>
                <th scope="col" className="table__number">실지급 합계</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="table__empty">불러오는 중…</td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={7} className="table__empty table__empty--error">
                    <p>{error}</p>
                    <button type="button" className="button button--secondary table__retry" onClick={handleRetry}>
                      다시 시도
                    </button>
                  </td>
                </tr>
              )}
              {!loading && !error && periods.length === 0 && (
                <tr>
                  <td colSpan={7} className="table__empty">
                    <p>아직 만든 급여 기간이 없습니다.</p>
                    <Link to="/payroll/new" className="button button--secondary table__retry">
                      급여 기간 만들기
                    </Link>
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                periods.map((period) => (
                  <tr
                    key={period.id}
                    className="table__row--link"
                    onClick={() => navigate(`/payroll/${period.id}`)}
                  >
                    <td className="table__strong">
                      <Link to={`/payroll/${period.id}`} className="table__link" onClick={(e) => e.stopPropagation()}>
                        {formatYearMonth(period.year, period.month)}
                      </Link>
                    </td>
                    <td className="table__mono">{period.paymentDate}</td>
                    <td>
                      <PayrollStatusBadge status={period.status} />
                    </td>
                    <td className="table__number">{period.payrollCount}</td>
                    <td className="table__number">{formatWon(period.totalEarnings)}</td>
                    <td className="table__number">{formatWon(period.totalDeductions)}</td>
                    <td className="table__number table__strong">{formatWon(period.totalNetPay)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
