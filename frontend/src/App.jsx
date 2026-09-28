import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import EmployeeCreatePage from './pages/EmployeeCreatePage'
import EmployeeDetailPage from './pages/EmployeeDetailPage'
import EmployeeEditPage from './pages/EmployeeEditPage'
import EmployeeListPage from './pages/EmployeeListPage'
import NotFoundPage from './pages/NotFoundPage'
import PayrollCreatePage from './pages/PayrollCreatePage'
import PayrollEditPage from './pages/PayrollEditPage'
import PayrollPeriodCreatePage from './pages/PayrollPeriodCreatePage'
import PayrollPeriodDetailPage from './pages/PayrollPeriodDetailPage'
import PayrollPeriodListPage from './pages/PayrollPeriodListPage'
import PayslipPage from './pages/PayslipPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/employees" replace />} />
        <Route path="employees" element={<EmployeeListPage />} />
        <Route path="employees/new" element={<EmployeeCreatePage />} />
        <Route path="employees/:id" element={<EmployeeDetailPage />} />
        <Route path="employees/:id/edit" element={<EmployeeEditPage />} />
        <Route path="payroll" element={<PayrollPeriodListPage />} />
        <Route path="payroll/new" element={<PayrollPeriodCreatePage />} />
        <Route path="payroll/:periodId" element={<PayrollPeriodDetailPage />} />
        <Route path="payroll/:periodId/payrolls/new" element={<PayrollCreatePage />} />
        <Route path="payroll/:periodId/payrolls/:payrollId/edit" element={<PayrollEditPage />} />
        <Route path="payrolls/:payrollId" element={<PayslipPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
