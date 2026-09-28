import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getPayItems, getPayroll, updatePayroll } from '../api/payrollApi'
import PageHeader from '../components/layout/PageHeader'
import PayrollForm from '../components/payroll/PayrollForm'
import SimulationNotice from '../components/payroll/SimulationNotice'
import { PAYROLL_STATUS } from '../constants/payrollStatus'
import { formatYearMonth } from '../utils/format'

/** 명세서의 지급·공제 항목 → { payItemId: 금액 문자열 } */
function toAmounts(payroll) {
  const amounts = {}
  for (const line of [...payroll.earnings, ...payroll.deductions]) {
    amounts[line.payItemId] = String(line.amount)
  }
  return amounts
}

export default function PayrollEditPage() {
  const { periodId, payrollId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null) // { payroll, items }
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let ignore = false
    Promise.all([getPayroll(payrollId), getPayItems()])
      .then(([payroll, items]) => {
        if (!ignore) setData({ payroll, items })
      })
      .catch((error) => {
        if (!ignore) setLoadError(error.message || '급여 정보를 불러오지 못했습니다.')
      })
    return () => {
      ignore = true
    }
  }, [payrollId])

  const payroll = data?.payroll
  const periodLabel = payroll ? formatYearMonth(payroll.period.year, payroll.period.month) : '급여 기간'
  const header = (
    <PageHeader
      breadcrumbs={[
        { label: '급여 관리', to: '/payroll' },
        { label: periodLabel, to: `/payroll/${periodId}` },
        { label: '급여 수정' },
      ]}
      title={payroll ? `${periodLabel} 급여 수정 · ${payroll.employeeName}` : '급여 수정'}
      description="금액과 메모를 수정합니다. 사원은 바꿀 수 없습니다. 세금·보험료는 자동 계산하지 않습니다."
    />
  )

  async function handleSubmit({ lines, memo }) {
    const updated = await updatePayroll(payrollId, { lines, memo })
    navigate(`/payrolls/${updated.id}`, {
      state: { notice: `${updated.employeeName}(${updated.employeeNo}) 사원의 급여를 수정했습니다.` },
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

  if (payroll.period.status === PAYROLL_STATUS.CONFIRMED) {
    return (
      <>
        {header}
        <div className="card empty-state">
          <p>확정된 급여 기간은 수정할 수 없습니다. 확정을 취소한 뒤 수정해 주세요.</p>
          <Link to={`/payrolls/${payroll.id}`} className="button button--secondary">
            급여명세서로
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      {header}
      <SimulationNotice />
      <PayrollForm
        key={payroll.id}
        mode="edit"
        items={data.items}
        employeeInfo={payroll}
        initialAmounts={toAmounts(payroll)}
        initialMemo={payroll.memo ?? ''}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/payrolls/${payroll.id}`)}
      />
    </>
  )
}
