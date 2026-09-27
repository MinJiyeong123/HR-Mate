import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteEmployee, getEmployee } from '../api/employeeApi'
import ConfirmDialog from '../components/common/ConfirmDialog'
import EmployeeStatusBadge from '../components/employee/EmployeeStatusBadge'
import PageHeader from '../components/layout/PageHeader'
import { EMPLOYMENT_STATUS } from '../constants/employmentStatus'

function display(value) {
  return value ?? '-'
}

function DetailItem({ label, children }) {
  return (
    <div className="detail-item">
      <dt className="detail-item__label">{label}</dt>
      <dd className="detail-item__value">{children}</dd>
    </div>
  )
}

export default function EmployeeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [employee, setEmployee] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

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

  async function handleDelete() {
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteEmployee(id)
      navigate('/employees', {
        state: { notice: `${employee.name}(${employee.employeeNo}) 사원이 삭제되었습니다.` },
      })
    } catch (error) {
      setDeleting(false)
      setConfirmOpen(false)
      setDeleteError(error.message || '삭제 중 오류가 발생했습니다.')
    }
  }

  const breadcrumbs = [{ label: '사원 관리', to: '/employees' }, { label: '사원 상세' }]

  if (loadError) {
    return (
      <>
        <PageHeader breadcrumbs={breadcrumbs} title="사원 상세" />
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
        <PageHeader breadcrumbs={breadcrumbs} title="사원 상세" />
        <div className="card empty-state">불러오는 중…</div>
      </>
    )
  }

  const isResigned = employee.employmentStatus === EMPLOYMENT_STATUS.RESIGNED

  return (
    <>
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={`${employee.name} 사원`}
        description="사원의 기본 정보와 재직 상태를 확인합니다."
        actions={
          <>
            <Link to="/employees" className="button button--ghost">
              목록
            </Link>
            <button type="button" className="button button--danger-outline" onClick={() => setConfirmOpen(true)}>
              삭제
            </button>
            <Link to={`/employees/${employee.id}/edit`} className="button button--primary">
              수정
            </Link>
          </>
        }
      />

      {deleteError && (
        <div className="alert alert--error" role="alert">
          {deleteError}
        </div>
      )}

      <section className="card profile">
        <div className="profile__avatar" aria-hidden="true">
          {employee.name.slice(0, 1)}
        </div>
        <div className="profile__main">
          <div className="profile__name">
            <strong>{employee.name}</strong>
            <EmployeeStatusBadge status={employee.employmentStatus} />
          </div>
          <p className="profile__meta">
            <span className="table__mono">{employee.employeeNo}</span>
            <span aria-hidden="true">·</span>
            {display(employee.department)}
            <span aria-hidden="true">·</span>
            {display(employee.position)}
          </p>
        </div>
      </section>

      <section className="card detail-card">
        <h2 className="form-section__title">기본 정보</h2>
        <dl className="detail-grid">
          <DetailItem label="사번">
            <span className="table__mono">{employee.employeeNo}</span>
          </DetailItem>
          <DetailItem label="이름">{employee.name}</DetailItem>
          <DetailItem label="입사일">
            <span className="table__mono">{employee.hireDate}</span>
          </DetailItem>
        </dl>

        <h2 className="form-section__title">소속 정보</h2>
        <dl className="detail-grid">
          <DetailItem label="부서">{display(employee.department)}</DetailItem>
          <DetailItem label="직급">{display(employee.position)}</DetailItem>
        </dl>

        <h2 className="form-section__title">연락처</h2>
        <dl className="detail-grid">
          <DetailItem label="전화번호">{display(employee.phone)}</DetailItem>
          <DetailItem label="이메일">{display(employee.email)}</DetailItem>
        </dl>

        <h2 className="form-section__title">재직 정보</h2>
        <dl className="detail-grid">
          <DetailItem label="재직 상태">
            <EmployeeStatusBadge status={employee.employmentStatus} />
          </DetailItem>
          <DetailItem label="퇴사일">
            {isResigned ? <span className="table__mono">{employee.resignationDate}</span> : '-'}
          </DetailItem>
        </dl>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="사원을 삭제할까요?"
        confirmLabel="삭제"
        tone="danger"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      >
        <p>
          <strong>
            {employee.name} ({employee.employeeNo})
          </strong>{' '}
          사원을 삭제합니다.
        </p>
        <ul className="dialog__list">
          <li>삭제된 사원은 사원 목록과 조회 화면에서 보이지 않습니다.</li>
          <li>삭제된 사원의 사번은 다시 사용할 수 없습니다.</li>
          <li>퇴사한 사원은 삭제하지 말고 수정 화면에서 퇴사 처리해 주세요.</li>
        </ul>
      </ConfirmDialog>
    </>
  )
}
