import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <div className="demo-banner" role="note">
          <strong>DEMO</strong>
          가상 데이터로 동작하는 포트폴리오용 화면입니다. 새로고침하면 등록·수정한 내용이 초기화됩니다.
        </div>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
