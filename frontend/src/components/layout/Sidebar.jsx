import { NavLink, useLocation } from 'react-router-dom'

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
      <circle cx="10" cy="7.5" r="3.5" />
      <path d="M20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.5 3.5 0 0 1 0 6.7" />
    </svg>
  )
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M16 14.5h2" />
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" />
    </svg>
  )
}

// 연말정산은 추후 단계에서 구현한다. 지금은 메뉴 위치만 보여 준다.
const UPCOMING_MENUS = [{ label: '연말정산', icon: <DocumentIcon /> }]

export default function Sidebar() {
  // 연간 급여 집계(/payroll/annual)에서는 "급여 관리" 대신 "연간 급여 집계"만 강조한다.
  const { pathname } = useLocation()
  const annualActive = pathname.startsWith('/payroll/annual')

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__logo" aria-hidden="true">HR</span>
        <div>
          <strong>HR Mate</strong>
          <span className="sidebar__subtitle">인사관리시스템</span>
        </div>
      </div>

      <nav className="sidebar__nav" aria-label="주 메뉴">
        <p className="sidebar__section">인사</p>
        <NavLink to="/employees" className="sidebar__link">
          <UsersIcon />
          사원 관리
        </NavLink>

        <p className="sidebar__section">급여 · 세무</p>
        <NavLink
          to="/payroll"
          className={({ isActive }) => `sidebar__link${isActive && !annualActive ? ' active' : ''}`}
        >
          <WalletIcon />
          급여 관리
        </NavLink>
        <NavLink to="/payroll/annual" className="sidebar__link">
          <ChartIcon />
          연간 급여 집계
        </NavLink>
        {UPCOMING_MENUS.map((menu) => (
          <span key={menu.label} className="sidebar__link sidebar__link--disabled" aria-disabled="true">
            {menu.icon}
            {menu.label}
            <span className="sidebar__tag">준비 중</span>
          </span>
        ))}
      </nav>

      {/* 진행 단계는 README에서 관리한다. 단계가 바뀌어도 고치지 않도록 고정 안내만 표시한다. */}
      <p className="sidebar__footer">포트폴리오 데모 · 가상 데이터</p>
    </aside>
  )
}
