import { EMPLOYMENT_STATUS, EMPLOYMENT_STATUS_LABEL } from '../../constants/employmentStatus'

export default function EmployeeStatusBadge({ status }) {
  const modifier = status === EMPLOYMENT_STATUS.ACTIVE ? 'active' : 'resigned'
  return <span className={`badge badge--${modifier}`}>{EMPLOYMENT_STATUS_LABEL[status] ?? status}</span>
}
