import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createPayroll, getEligibleEmployees, getPayItems, getPayrollPeriod } from '../api/payrollApi'
import PageHeader from '../components/layout/PageHeader'
import PayrollForm from '../components/payroll/PayrollForm'
import SimulationNotice from '../components/payroll/SimulationNotice'
import { PAYROLL_STATUS } from '../constants/payrollStatus'
import { formatYearMonth } from '../utils/format'

export default function PayrollCreatePage() {
  const { periodId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null) // { period, items, employees }
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let ignore = false
    Promise.all([getPayrollPeriod(periodId), getPayItems(), getEligibleEmployees(periodId)])
      .then(([period, items, employees]) => {
        if (!ignore) setData({ period, items, employees })
      })
      .catch((error) => {
        if (!ignore) setLoadError(error.message || '급여 입력 화면을 불러오지 못했습니다.')
      })
    return () => {
      ignore = true
    }
  }, [periodId])

  const periodLabel = data ? formatYearMonth(data.period.year, data.period.month) : '급여 기간'
  const header = (
    <PageHeader
      breadcrumbs={[
        { label: '급여 관리', to: '/payroll' },
        { label: periodLabel, to: `/payroll/${periodId}` },
        { label: '급여 입력' },
      ]}
      title={`${periodLabel} 급여 입력`}
      description="지급·공제 금액을 직접 입력합니다. 세금·보험료는 자동 계산하지 않습니다."
    />
  )

  async function handleSubmit(payload) {
    const created = await createPayroll(periodId, payload)
    navigate(`/payrolls/${created.id}`, {
      state: { notice: `${created.employeeName}(${created.employeeNo}) 사원의 급여를 입력했습니다.` },
    })
  }

  if (loadError || !data) {
    return (
      <>
        {header}
        <div className="card empty-state">
          <p>{loadError || '불러오는 중…'}</p>
          {loadError && (
            <Link to={`/payroll/${periodId}`} className="button button--secondary">
              급여 기간으로
            </Link>
          )}
        </div>
      </>
    )
  }

  if (data.period.status === PAYROLL_STATUS.CONFIRMED) {
    return (
      <>
        {header}
        <div className="card empty-state">
          <p>확정된 급여 기간에는 급여를 입력할 수 없습니다. 확정을 취소한 뒤 입력해 주세요.</p>
          <Link to={`/payroll/${periodId}`} className="button button--secondary">
            급여 기간으로
          </Link>
        </div>
      </>
    )
  }

  if (data.employees.length === 0) {
    return (
      <>
        {header}
        <SimulationNotice />
        <div className="card empty-state">
          <p>이 달에 급여를 입력할 수 있는 사원이 없습니다.</p>
          <p className="table__sub-note">
            해당 월에 재직한 사원이 없거나, 모든 사원의 급여가 이미 입력되었습니다.
          </p>
          <div className="empty-state__actions">
            <Link to={`/payroll/${periodId}`} className="button button--ghost">
              급여 기간으로
            </Link>
            <Link to="/employees" className="button button--secondary">
              사원 관리로
            </Link>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {header}
      <SimulationNotice />
      <PayrollForm
        mode="create"
        items={data.items}
        employees={data.employees}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/payroll/${periodId}`)}
      />
    </>
  )
}
