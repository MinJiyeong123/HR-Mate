import { Fragment } from 'react'
import { Link } from 'react-router-dom'

/**
 * 페이지 상단 제목 영역
 * breadcrumbs: [{ label, to? }] - to가 없으면 현재 위치로 표시
 */
export default function PageHeader({ breadcrumbs = [], title, description, actions }) {
  return (
    <header className="page-header">
      <div>
        {breadcrumbs.length > 0 && (
          <nav className="breadcrumbs" aria-label="현재 위치">
            {breadcrumbs.map((crumb, index) => (
              <Fragment key={crumb.label}>
                {index > 0 && <span aria-hidden="true">›</span>}
                {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : <span>{crumb.label}</span>}
              </Fragment>
            ))}
          </nav>
        )}
        <h1 className="page-header__title">{title}</h1>
        {description && <p className="page-header__description">{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  )
}
