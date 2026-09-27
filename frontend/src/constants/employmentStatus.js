// 재직 상태 값. 백엔드 enum(EmploymentStatus)과 같은 문자열을 사용한다.
export const EMPLOYMENT_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  RESIGNED: 'RESIGNED',
})

export const EMPLOYMENT_STATUS_LABEL = Object.freeze({
  [EMPLOYMENT_STATUS.ACTIVE]: '재직',
  [EMPLOYMENT_STATUS.RESIGNED]: '퇴사',
})

export const EMPLOYMENT_STATUS_OPTIONS = [
  { value: EMPLOYMENT_STATUS.ACTIVE, label: EMPLOYMENT_STATUS_LABEL.ACTIVE },
  { value: EMPLOYMENT_STATUS.RESIGNED, label: EMPLOYMENT_STATUS_LABEL.RESIGNED },
]
