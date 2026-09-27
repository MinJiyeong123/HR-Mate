import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getEmployees } from '../api/employeeApi'
import EmployeeStatusBadge from '../components/employee/EmployeeStatusBadge'
import PageHeader from '../components/layout/PageHeader'
import { EMPLOYMENT_STATUS } from '../constants/employmentStatus'

function display(value) {
  return value ?? '-'
}

export default function EmployeeListPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // 등록·수정 화면에서 넘겨준 완료 메시지
  const [notice, setNotice] = useState(location.state?.notice ?? '')

  useEffect(() => {
    // 새로고침했을 때 완료 메시지가 다시 뜨지 않도록 주소의 상태 값을 비운다.
    if (location.state?.notice) navigate(location.pathname, { replace: true, state: null })
  }, [location, navigate])

  useEffect(() => {
    let ignore = false
    getEmployees()
      .then((data) => {
        if (!ignore) setEmployees(data)
      })
      .catch(() => {
        if (!ignore) setError('사원 목록을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  const activeCount = employees.filter((item) => item.employmentStatus === EMPLOYMENT_STATUS.ACTIVE).length
  const resignedCount = employees.length - activeCount

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: '사원 관리' }, { label: '사원 목록' }]}
        title="사원 목록"
        description="등록된 사원의 기본 정보와 재직 상태를 확인합니다."
        actions={
          <Link to="/employees/new" className="button button--primary">
            + 사원 등록
          </Link>
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

      <div className="stats">
        <div className="stat-card">
          <span className="stat-card__label">전체 사원</span>
          <strong className="stat-card__value">{loading ? '–' : employees.length}</strong>
        </div>
        <div className="stat-card stat-card--active">
          <span className="stat-card__label">재직</span>
          <strong className="stat-card__value">{loading ? '–' : activeCount}</strong>
        </div>
        <div className="stat-card stat-card--resigned">
          <span className="stat-card__label">퇴사</span>
          <strong className="stat-card__value">{loading ? '–' : resignedCount}</strong>
        </div>
      </div>

      <section className="card">
        <div className="card__header">
          <h2 className="card__title">사원 현황</h2>
          <span className="card__meta">사번 순 정렬</span>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">사번</th>
                <th scope="col">이름</th>
                <th scope="col">부서</th>
                <th scope="col">직급</th>
                <th scope="col">입사일</th>
                <th scope="col">재직 상태</th>
                <th scope="col" className="table__actions">관리</th>
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
                  <td colSpan={7} className="table__empty table__empty--error">{error}</td>
                </tr>
              )}
              {!loading && !error && employees.length === 0 && (
                <tr>
                  <td colSpan={7} className="table__empty">등록된 사원이 없습니다.</td>
                </tr>
              )}
              {!loading &&
                !error &&
                employees.map((employee) => (
                  <tr key={employee.id}>
                    <td className="table__mono">{employee.employeeNo}</td>
                    <td className="table__strong">{employee.name}</td>
                    <td>{display(employee.department)}</td>
                    <td>{display(employee.position)}</td>
                    <td className="table__mono">{employee.hireDate}</td>
                    <td>
                      <EmployeeStatusBadge status={employee.employmentStatus} />
                      {employee.resignationDate && (
                        <span className="table__sub">{employee.resignationDate} 퇴사</span>
                      )}
                    </td>
                    <td className="table__actions">
                      <Link to={`/employees/${employee.id}/edit`} className="button button--small">
                        수정
                      </Link>
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
