// 규칙 출처: docs/requirements-year-end.md 4장 (백엔드 PersonalDeductionInput·YearEndInputRequest 와 같은 규칙)
// 화면 검증은 사용자 편의를 위한 것이며, 최종 검증은 서버가 담당한다.

export const MAX_DEPENDENT_COUNT = 20
export const MAX_BIRTH_THIRD_PLUS_COUNT = 10

/** API 입력 항목 10개 (요청 본문에 이 항목만 담는다) */
export const INPUT_FIELDS = [
  'spouseDeduction',
  'dependentCount',
  'elderlyCount',
  'disabledCount',
  'womanDeduction',
  'singleParentDeduction',
  'childCreditCount',
  'birthFirstCount',
  'birthSecondCount',
  'birthThirdPlusCount',
]

/** 입력 자료가 없을 때 기본값: 본인 기본공제만 */
export const DEFAULT_INPUT = {
  spouseDeduction: false,
  dependentCount: 0,
  elderlyCount: 0,
  disabledCount: 0,
  womanDeduction: false,
  singleParentDeduction: false,
  childCreditCount: 0,
  birthFirstCount: 0,
  birthSecondCount: 0,
  birthThirdPlusCount: 0,
}

/** API 응답에서 입력 항목만 꺼낸다. */
export function pickInput(source) {
  return Object.fromEntries(INPUT_FIELDS.map((field) => [field, source?.[field] ?? DEFAULT_INPUT[field]]))
}

/** 기본공제 대상자 수 (본인 1 + 배우자 + 부양가족) */
export function basicDeductionCount(values) {
  return 1 + (values.spouseDeduction ? 1 : 0) + values.dependentCount
}

/** 인원 항목별 선택 가능한 최대값 (드롭다운 범위) */
export function maxCounts(values) {
  const basic = basicDeductionCount(values)
  return {
    dependentCount: MAX_DEPENDENT_COUNT,
    elderlyCount: basic,
    disabledCount: basic,
    childCreditCount: values.dependentCount,
    birthFirstCount: 1,
    birthSecondCount: 1,
    birthThirdPlusCount: Math.min(MAX_BIRTH_THIRD_PLUS_COUNT, values.dependentCount),
  }
}

/**
 * 입력 검증. 항목별 오류는 항목 이름, 여러 항목에 걸친 오류는 input 키로 돌려준다(서버와 같은 형식).
 * @returns {Object<string,string>} 오류가 없으면 빈 객체
 */
export function validateYearEndInput(values) {
  const errors = {}
  const basic = basicDeductionCount(values)
  const outOfRange = (value, min, max) => !Number.isInteger(value) || value < min || value > max

  if (outOfRange(values.dependentCount, 0, MAX_DEPENDENT_COUNT)) {
    errors.dependentCount = `부양가족 인원은 0~${MAX_DEPENDENT_COUNT}명으로 입력해 주세요.`
  }
  if (outOfRange(values.elderlyCount, 0, basic)) {
    errors.elderlyCount = `경로우대 인원은 기본공제 대상자 수(${basic}명) 이하로 입력해 주세요.`
  }
  if (outOfRange(values.disabledCount, 0, basic)) {
    errors.disabledCount = `장애인 인원은 기본공제 대상자 수(${basic}명) 이하로 입력해 주세요.`
  }
  if (outOfRange(values.childCreditCount, 0, values.dependentCount)) {
    errors.childCreditCount = '자녀세액공제 대상 자녀 수는 부양가족 인원 이하로 입력해 주세요.'
  }
  if (outOfRange(values.birthFirstCount, 0, 1)) errors.birthFirstCount = '출산·입양 첫째는 0~1명으로 입력해 주세요.'
  if (outOfRange(values.birthSecondCount, 0, 1)) errors.birthSecondCount = '출산·입양 둘째는 0~1명으로 입력해 주세요.'
  if (outOfRange(values.birthThirdPlusCount, 0, MAX_BIRTH_THIRD_PLUS_COUNT)) {
    errors.birthThirdPlusCount = `출산·입양 셋째 이상은 0~${MAX_BIRTH_THIRD_PLUS_COUNT}명으로 입력해 주세요.`
  }
  if (values.spouseDeduction && values.singleParentDeduction) {
    errors.input = '배우자 기본공제와 한부모 공제는 함께 선택할 수 없습니다.'
  } else if (values.birthFirstCount + values.birthSecondCount + values.birthThirdPlusCount > values.dependentCount) {
    errors.input = '출산·입양 자녀 수의 합은 부양가족 인원 이하로 입력해 주세요.'
  }
  return errors
}
