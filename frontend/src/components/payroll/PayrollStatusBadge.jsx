import { PAYROLL_STATUS, PAYROLL_STATUS_LABEL } from '../../constants/payrollStatus'

export default function PayrollStatusBadge({ status }) {
  const modifier = status === PAYROLL_STATUS.CONFIRMED ? 'confirmed' : 'draft'
  return <span className={`badge badge--${modifier}`}>{PAYROLL_STATUS_LABEL[status] ?? status}</span>
}
