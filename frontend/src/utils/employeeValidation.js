import { EMPLOYMENT_STATUS } from '../constants/employmentStatus'

// 규칙 출처: docs/requirements-mvp1.md (2~4장)
// 화면 검증은 사용자 편의를 위한 것이며, 최종 검증은 서버가 담당한다.

export const EMPLOYEE_NO_MAX_LENGTH = 20
export const NAME_MAX_LENGTH = 50
export const DEPARTMENT_MAX_LENGTH = 100
export const POSITION_MAX_LENGTH = 50
export const EMAIL_MAX_LENGTH = 100

const EMPLOYEE_NO_PATTERN = /^[A-Za-z0-9]+$/
// 휴대전화(010-1234-5678)와 지역번호(02-123-4567, 031-123-4567) 형식
const PHONE_PATTERN = /^0\d{1,2}-\d{3,4}-\d{4}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function text(value) {
  return (value ?? '').toString()
}

function isValidDate(value) {
  return DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value))
}

/** 사번은 대문자로 통일해서 저장한다. */
export function normalizeEmployeeNo(value) {
  return text(value).toUpperCase()
}

/** 사번 형식 오류 메시지를 돌려준다. 문제가 없으면 null. */
export function validateEmployeeNo(value) {
  const employeeNo = text(value)
  if (employeeNo === '') return '사번을 입력해 주세요.'
  if (/\s/.test(employeeNo)) return '사번에는 공백을 사용할 수 없습니다.'
  if (!EMPLOYEE_NO_PATTERN.test(employeeNo)) return '사번은 영문과 숫자만 입력할 수 있습니다.'
  if (employeeNo.length > EMPLOYEE_NO_MAX_LENGTH) {
    return `사번은 ${EMPLOYEE_NO_MAX_LENGTH}자 이하로 입력해 주세요.`
  }
  return null
}

/**
 * 사원 입력값을 검증하고 { 필드명: 오류 메시지 } 객체를 돌려준다.
 * includeEmployeeNo: 등록 화면에서만 true (사번은 등록 후 수정 불가)
 */
export function validateEmployee(values, { includeEmployeeNo }) {
  const errors = {}

  if (includeEmployeeNo) {
    const employeeNoError = validateEmployeeNo(values.employeeNo)
    if (employeeNoError) errors.employeeNo = employeeNoError
  }

  const name = text(values.name).trim()
  if (name === '') errors.name = '이름을 입력해 주세요.'
  else if (name.length > NAME_MAX_LENGTH) errors.name = `이름은 ${NAME_MAX_LENGTH}자 이하로 입력해 주세요.`

  const hireDate = text(values.hireDate)
  if (hireDate === '') errors.hireDate = '입사일을 입력해 주세요.'
  else if (!isValidDate(hireDate)) errors.hireDate = '올바른 날짜를 입력해 주세요.'

  if (text(values.department).trim().length > DEPARTMENT_MAX_LENGTH) {
    errors.department = `부서는 ${DEPARTMENT_MAX_LENGTH}자 이하로 입력해 주세요.`
  }
  if (text(values.position).trim().length > POSITION_MAX_LENGTH) {
    errors.position = `직급은 ${POSITION_MAX_LENGTH}자 이하로 입력해 주세요.`
  }

  const phone = text(values.phone).trim()
  if (phone !== '' && !PHONE_PATTERN.test(phone)) {
    errors.phone = '전화번호는 010-1234-5678 또는 02-123-4567 형식으로 입력해 주세요.'
  }

  const email = text(values.email).trim()
  if (email.length > EMAIL_MAX_LENGTH) errors.email = `이메일은 ${EMAIL_MAX_LENGTH}자 이하로 입력해 주세요.`
  else if (email !== '' && !EMAIL_PATTERN.test(email)) errors.email = '올바른 이메일 형식이 아닙니다.'

  const status = values.employmentStatus ?? EMPLOYMENT_STATUS.ACTIVE
  const resignationDate = text(values.resignationDate)
  if (status === EMPLOYMENT_STATUS.ACTIVE) {
    if (resignationDate !== '') errors.resignationDate = '재직 상태에서는 퇴사일을 비워 주세요.'
  } else if (status === EMPLOYMENT_STATUS.RESIGNED) {
    if (resignationDate === '') errors.resignationDate = '퇴사 상태에서는 퇴사일을 입력해 주세요.'
    else if (!isValidDate(resignationDate)) errors.resignationDate = '올바른 날짜를 입력해 주세요.'
    else if (isValidDate(hireDate) && resignationDate < hireDate) {
      errors.resignationDate = '퇴사일은 입사일보다 빠를 수 없습니다.'
    }
  } else {
    errors.employmentStatus = '재직 상태를 선택해 주세요.'
  }

  return errors
}

/** 폼 입력값을 서버로 보낼 형태로 바꾼다. 빈 문자열은 null로 보낸다. */
export function toEmployeePayload(values, { includeEmployeeNo }) {
  const optional = (value) => {
    const trimmed = text(value).trim()
    return trimmed === '' ? null : trimmed
  }

  const payload = {
    name: text(values.name).trim(),
    hireDate: values.hireDate,
    department: optional(values.department),
    position: optional(values.position),
    phone: optional(values.phone),
    email: optional(values.email),
    employmentStatus: values.employmentStatus,
    resignationDate: optional(values.resignationDate),
  }
  if (includeEmployeeNo) payload.employeeNo = normalizeEmployeeNo(values.employeeNo)
  return payload
}

/** 서버에서 받은 사원 정보를 폼 입력값으로 바꾼다. null은 빈 문자열로 바꾼다. */
export function toEmployeeFormValues(employee) {
  return {
    employeeNo: employee.employeeNo,
    name: employee.name,
    hireDate: employee.hireDate,
    department: employee.department ?? '',
    position: employee.position ?? '',
    phone: employee.phone ?? '',
    email: employee.email ?? '',
    employmentStatus: employee.employmentStatus,
    resignationDate: employee.resignationDate ?? '',
  }
}
