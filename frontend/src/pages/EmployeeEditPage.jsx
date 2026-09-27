import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getEmployee, updateEmployee } from '../api/employeeApi'
import EmployeeForm from '../components/employee/EmployeeForm'
import PageHeader from '../components/layout/PageHeader'
import { toEmployeeFormValues } from '../utils/employeeValidation'

export default function EmployeeEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [employee, setEmployee] = useState(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let ignore = false
    getEmployee(id)
      .then((data) => {
        if (!ignore) setEmployee(data)
      })
      .catch((error) => {
        if (!ignore) setLoadError(error.message || '사원 정보를 불러오지 못했습니다.')
      })
    return () => {
      ignore = true
    }
  }, [id])

  async function handleSubmit(payload) {
    const updated = await updateEmployee(id, payload)
    navigate('/employees', {
      state: { notice: `${updated.name}(${updated.employeeNo}) 사원 정보가 수정되었습니다.` },
    })
  }

  const header = (
    <PageHeader
      breadcrumbs={[{ label: '사원 관리', to: '/employees' }, { label: '사원 수정' }]}
      title={employee ? `사원 수정 · ${employee.name}` : '사원 수정'}
      description="사원 정보를 수정하거나 퇴사 처리합니다. 사번은 수정할 수 없습니다."
    />
  )

  if (loadError) {
    return (
      <>
        {header}
        <div className="card empty-state">
          <p>{loadError}</p>
          <Link to="/employees" className="button button--secondary">
            사원 목록으로
          </Link>
        </div>
      </>
    )
  }

  if (!employee) {
    return (
      <>
        {header}
        <div className="card empty-state">불러오는 중…</div>
      </>
    )
  }

  return (
    <>
      {header}
      <EmployeeForm
        key={employee.id}
        mode="edit"
        initialValues={toEmployeeFormValues(employee)}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/employees')}
      />
    </>
  )
}
