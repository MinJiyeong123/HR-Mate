// 체험 모드 오류 형태: src/api/client.js 의 ApiError(status, message, fieldErrors) 와 같다.
// 문구는 백엔드 ErrorCode·GlobalExceptionHandler 와 같게 맞춘다.

export class ApiError extends Error {
  constructor(status, message, fieldErrors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

export const MESSAGES = {
  INVALID_INPUT: '입력값을 확인해 주세요.',
  NOT_READABLE: '요청 형식이 올바르지 않습니다. JSON 형식과 날짜(YYYY-MM-DD), 재직 상태 값을 확인해 주세요.',
  NOT_FOUND: '요청한 주소를 찾을 수 없습니다.',
  METHOD_NOT_ALLOWED: '지원하지 않는 요청 방식입니다.',
  NOT_READY: '체험 모드에서 아직 준비 중인 기능입니다.',
}

/** 400 INVALID_INPUT (항목별 오류) */
export const invalidInput = (fieldErrors) => new ApiError(400, MESSAGES.INVALID_INPUT, fieldErrors)
/** 400 본문을 읽을 수 없음 (깨진 형식, 잘못된 날짜·재직 상태 값) */
export const notReadable = () => new ApiError(400, MESSAGES.NOT_READABLE, {})
/** 400 경로·파라미터 형식 오류 (예: /api/employees/abc) */
export const typeMismatch = (name) => new ApiError(400, MESSAGES.INVALID_INPUT, { [name]: '형식이 올바르지 않습니다.' })
export const notFoundPath = () => new ApiError(404, MESSAGES.NOT_FOUND, {})
export const methodNotAllowed = () => new ApiError(405, MESSAGES.METHOD_NOT_ALLOWED, {})
export const notReady = () => new ApiError(501, MESSAGES.NOT_READY, {})
