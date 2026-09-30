import { Outlet } from 'react-router-dom'
import DemoBanner from '../../demo/DemoBanner'
import Sidebar from './Sidebar'

const IS_DEMO_MODE = import.meta.env.MODE === 'demo'

export default function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        {IS_DEMO_MODE ? (
          <DemoBanner />
        ) : (
          <div className="demo-banner" role="note">
            <strong>DEMO</strong>
            포트폴리오용 화면입니다. 실제 개인정보 대신 가상 데이터만 입력해 주세요.
          </div>
        )}
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
