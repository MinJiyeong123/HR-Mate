// ------------------------------------------------------------------
// 공통 API 요청 함수 (사원·급여 API가 함께 사용)
// - 주소는 상대 경로(/api/...)를 쓴다. 개발 중에는 Vite 프록시가 백엔드(8080)로 전달한다.
// - 오류는 ApiError(status, message, fieldErrors) 로 던진다. 서버에 연결하지 못하면 status 0.
// ------------------------------------------------------------------

const NETWORK_ERROR_MESSAGE = '서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인해 주세요.'

const DEFAULT_MESSAGES = {
  400: '입력값을 확인해 주세요.',
  404: '요청한 정보를 찾을 수 없습니다.',
  409: '이미 사용된 값입니다.',
}
const SERVER_ERROR_MESSAGE = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'

export class ApiError extends Error {
  constructor(status, message, fieldErrors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status // 0: 서버에 연결하지 못함
    this.fieldErrors = fieldErrors
  }
}

async function readJson(response) {
  const contentType = response.headers.get('Content-Type') ?? ''
  if (!contentType.includes('application/json')) return null
  try {
    return await response.json()
  } catch {
    return null
  }
}

export async function request(path, { method = 'GET', body } = {}) {
  const options = { method, headers: { Accept: 'application/json' } }
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }

  let response
  try {
    response = await fetch(path, options)
  } catch {
    throw new ApiError(0, NETWORK_ERROR_MESSAGE)
  }

  if (response.status === 204) return null

  const data = await readJson(response)
  if (response.ok) return data

  // 공통 오류 응답 { status, code, message, fieldErrors } 이 없으면(예: 프록시 오류) 상태별 기본 안내
  const fallback =
    response.status >= 500 ? (data ? SERVER_ERROR_MESSAGE : NETWORK_ERROR_MESSAGE) : DEFAULT_MESSAGES[response.status]
  throw new ApiError(response.status, data?.message ?? fallback ?? SERVER_ERROR_MESSAGE, data?.fieldErrors ?? {})
}
