// ------------------------------------------------------------------
// 체험 모드 전용 API 요청 함수 (vite --mode demo 에서만 사용)
// - vite.config.js 가 체험 모드일 때 src/api/client.js 대신 이 파일을 연결한다.
// - 네트워크 요청(fetch 등)을 하지 않는다. 방문자 데이터는 서버로 전송되지 않고 이 브라우저(localStorage)에만 저장된다.
// - 사용법과 오류 형태는 src/api/client.js 와 같다: request(path, { method, body }), ApiError(status, message, fieldErrors)
// - 처리 범위는 router.js 참고 (D1-4: 사원·급여). 나머지는 "준비 중" 오류(501)로 돌려준다.
// ------------------------------------------------------------------
import { handleDemoRequest } from './router.js'
import { getDemoStore } from './store.js'

export { ApiError } from './errors.js'

export async function request(path, options = {}) {
  return handleDemoRequest(getDemoStore(), path, options)
}
