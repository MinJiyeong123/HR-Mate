import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getYearEndEmployees } from '../api/yearEndApi'
import PageHeader from '../components/layout/PageHeader'
import AnnualYearSelect from '../components/payroll/AnnualYearSelect'
import BalanceText from '../components/yearend/BalanceText'
import YearEndNotice from '../components/yearend/YearEndNotice'
import { formatWon } from '../utils/format'

const COLUMN_COUNT = 8

function toErrorMessage(error) {
  return error.fieldErrors?.year ?? error.message ?? '연말정산 목록을 불러오지 못했습니다.'
}

/** 연말정산 목록 (포트폴리오용 모의 계산, 조회만) */
export default function YearEndListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const year = searchParams.get('year') ?? String(new Date().getFullYear())
  const [reloadKey, setReloadKey] = useState(0)
  const requestKey = `${year}#${reloadKey}`
  // 응답을 요청 키와 함께 저장해, 연도를 바꾸면 새 응답이 올 때까지 "불러오는 중"으로 보인다.
  const [result, setResult] = useState({ key: null, data: null, error: '' })

  useEffect(() => {
    let ignore = false
    getYearEndEmployees(year)
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
  const error = loading ? '' : result.error
  const employees = (!loading && result.data) || []
  const savedCount = employees.filter((employee) => employee.inputSaved).length
  const payTotal = employees.reduce((sum, employee) => sum + Math.max(employee.balance, 0), 0)
  const refundTotal = employees.reduce((sum, employee) => sum + Math.max(-employee.balance, 0), 0)
  const resultPath = (employeeId) => `/year-end/employees/${employeeId}?year=${encodeURIComponent(year)}`

  function statValue(value) {
    return loading || error ? '–' : value
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: '연말정산' }, { label: '목록' }]}
        title="연말정산"
        description="귀속 연도에 확정된 급여가 있는 사원의 모의 계산 요약입니다. 행을 누르면 계산 결과로 이동합니다."
        actions={<AnnualYearSelect value={year} onChange={(next) => setSearchParams({ year: next })} />}
      />

      <YearEndNotice />

      <div className="stats stats--four">
        <div className="stat-card">
          <span className="stat-card__label">대상 인원</span>
          <strong className="stat-card__value">{statValue(`${employees.length}명`)}</strong>
          <span className="stat-card__sub">입력 완료 {statValue(`${savedCount}명`)}</span>
        </div>
        <div className="stat-card stat-card--resigned">
          <span className="stat-card__label">추가 납부 합계</span>
          <strong className="stat-card__value stat-card__value--money">{statValue(formatWon(payTotal))}</strong>
        </div>
        <div className="stat-card stat-card--active">
          <span className="stat-card__label">환급 합계</span>
          <strong className="stat-card__value stat-card__value--money">{statValue(formatWon(refundTotal))}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">적용 규칙</span>
          <strong className="stat-card__value stat-card__value--money">2025년 귀속</strong>
          <span className="stat-card__sub">다른 연도는 결과 화면에서 경고</span>
        </div>
      </div>

      <section className="card">
        <div className="card__header">
          <h2 className="card__title">사원별 모의 계산</h2>
          <span className="card__meta">사번 순 · 사원 정보는 그 해 마지막 확정 급여 기준</span>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">사번</th>
                <th scope="col">이름</th>
                <th scope="col">부서</th>
                <th scope="col">입력 자료</th>
                <th scope="col" className="table__number">총급여</th>
                <th scope="col" className="table__number">결정세액</th>
                <th scope="col" className="table__number">기납부세액</th>
                <th scope="col" className="table__number">추가 납부 / 환급</th>
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
                    onClick={() => navigate(resultPath(employee.employeeId))}
                  >
                    <td className="table__mono">{employee.employeeNo}</td>
                    <td className="table__strong">
                      <Link
                        to={resultPath(employee.employeeId)}
                        className="table__link"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {employee.employeeName}
                      </Link>
                      {employee.deleted && <span className="badge badge--deleted">삭제됨</span>}
                      {employee.resigned && <span className="badge badge--resigned badge--inline">퇴사</span>}
                    </td>
                    <td>{employee.department ?? '-'}</td>
                    <td>
                      <span className={`badge ${employee.inputSaved ? 'badge--confirmed' : 'badge--resigned'}`}>
                        {employee.inputSaved ? '입력함' : '미입력'}
                      </span>
                    </td>
                    <td className="table__number">{formatWon(employee.totalSalary)}</td>
                    <td className="table__number">{formatWon(employee.determinedTax)}</td>
                    <td className="table__number">{formatWon(employee.prepaidTax)}</td>
                    <td className="table__number table__strong">
                      <BalanceText balance={employee.balance} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
