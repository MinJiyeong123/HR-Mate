import { useNavigate } from 'react-router-dom'
import { checkEmployeeNo, createEmployee } from '../api/employeeApi'
import EmployeeForm from '../components/employee/EmployeeForm'
import PageHeader from '../components/layout/PageHeader'

export default function EmployeeCreatePage() {
  const navigate = useNavigate()

  async function handleSubmit(payload) {
    const created = await createEmployee(payload)
    navigate('/employees', {
      state: { notice: `${created.name}(${created.employeeNo}) 사원이 등록되었습니다.` },
    })
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: '사원 관리', to: '/employees' }, { label: '사원 등록' }]}
        title="사원 등록"
        description="필수 항목(*)을 입력하고 사번 중복 확인 후 등록합니다."
      />
      <EmployeeForm
        mode="create"
        onSubmit={handleSubmit}
        onCancel={() => navigate('/employees')}
        onCheckEmployeeNo={checkEmployeeNo}
      />
    </>
  )
}
