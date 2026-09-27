import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="card empty-state">
      <h1 className="empty-state__title">페이지를 찾을 수 없습니다</h1>
      <p>주소가 올바른지 확인해 주세요.</p>
      <Link to="/employees" className="button button--primary">
        사원 목록으로
      </Link>
    </div>
  )
}
