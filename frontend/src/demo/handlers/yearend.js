// ------------------------------------------------------------------
// 체험 모드 연말정산 API (브라우저 저장소 사용, 네트워크 요청 없음, 포트폴리오용 모의 계산 · 전문가 검증 전)
// 계약: docs/api/year-end-api.md / 규칙 원본: 백엔드 YearEndController·YearEndService·YearEndInputRequest·*Response
//   GET /api/year-end/{year}/employees                 그 해 확정 급여가 있는 사원 목록과 계산 요약 (사번 순)
//   GET /api/year-end/{year}/employees/{id}/input      입력 자료 (없으면 saved=false 와 기본값)
//   PUT /api/year-end/{year}/employees/{id}/input      입력 자료 저장 (생성 또는 전체 교체)
//   GET /api/year-end/{year}/employees/{id}/result     모의 계산 결과 (확정 급여가 없으면 calculable=false)
// - 계산은 yearend/ 의 계산기(백엔드 Java 와 결과 비교 검증)를 그대로 쓴다. 이 파일은 저장소 읽기·쓰기와 응답 조립만 한다.
// - 해당 귀속연도(기간의 year)의 확정 급여만 사용한다. 계산 결과는 저장하지 않고 조회할 때마다 계산한다.
// - 논리 삭제된 사원은 조회·계산만 가능하고 입력 자료를 저장할 수 없다(409).
// ------------------------------------------------------------------
import { ApiError, invalidInput, methodNotAllowed, notFoundPath, notReadable, typeMismatch } from '../errors.js'
import { PAY_ITEMS } from '../seed.js'
import { ASSUMPTIONS, calculateYearEnd, MAX_YEAR, MIN_YEAR, SELF_ONLY, validatePersonalDeductionInput } from '../yearend/calculator.js'
import { childCreditAgeGuide } from '../yearend/childCreditAgeGuide.js'
import { yearEndPayrollTotals } from '../yearend/payrollTotals.js'
import { byEmployeeNo } from './payroll.js'

/** YearEndService.NOTICE */
export const NOTICE = '모의 계산 · 전문가 검증 전 · 지방소득세 미포함'

/** 입력 항목 10개 (요청 본문·저장 형식·응답에 같은 이름으로 쓴다) */
const BOOLEAN_FIELDS = ['spouseDeduction', 'womanDeduction', 'singleParentDeduction']
const INPUT_FIELDS = ['spouseDeduction', 'dependentCount', 'elderlyCount', 'disabledCount', 'womanDeduction', 'singleParentDeduction', 'childCreditCount', 'birthFirstCount', 'birthSecondCount', 'birthThirdPlusCount']

/**
 * YearEndInputRequest 의 항목별 검사 (선언 순서, 항목마다 첫 번째 위반만). [항목, 비었을 때 문구, 최소, 최대, 최소 위반 문구, 최대 위반 문구]
 * 여러 항목에 걸친 규칙(기본공제 대상자 수·부양가족 인원 이하 등)은 이후 validatePersonalDeductionInput 이 검사한다.
 */
const FIELD_RULES = [
  ['spouseDeduction', '배우자 기본공제 여부를 선택해 주세요.'],
  ['dependentCount', '부양가족 인원을 입력해 주세요.', 0, 20, '부양가족 인원은 0~20명으로 입력해 주세요.', '부양가족 인원은 0~20명으로 입력해 주세요.'],
  ['elderlyCount', '경로우대 인원을 입력해 주세요.', 0, 22, '경로우대 인원은 0명 이상으로 입력해 주세요.', '경로우대 인원은 기본공제 대상자 수 이하로 입력해 주세요.'],
  ['disabledCount', '장애인 인원을 입력해 주세요.', 0, 22, '장애인 인원은 0명 이상으로 입력해 주세요.', '장애인 인원은 기본공제 대상자 수 이하로 입력해 주세요.'],
  ['womanDeduction', '부녀자 공제 여부를 선택해 주세요.'],
  ['singleParentDeduction', '한부모 공제 여부를 선택해 주세요.'],
  ['childCreditCount', '자녀세액공제 대상 자녀 수를 입력해 주세요.', 0, 20, '자녀세액공제 대상 자녀 수는 0명 이상으로 입력해 주세요.', '자녀세액공제 대상 자녀 수는 부양가족 인원 이하로 입력해 주세요.'],
  ['birthFirstCount', '출산·입양 첫째 인원을 입력해 주세요.', 0, 1, '출산·입양 첫째는 0~1명으로 입력해 주세요.', '출산·입양 첫째는 0~1명으로 입력해 주세요.'],
  ['birthSecondCount', '출산·입양 둘째 인원을 입력해 주세요.', 0, 1, '출산·입양 둘째는 0~1명으로 입력해 주세요.', '출산·입양 둘째는 0~1명으로 입력해 주세요.'],
  ['birthThirdPlusCount', '출산·입양 셋째 이상 인원을 입력해 주세요.', 0, 10, '출산·입양 셋째 이상은 0~10명으로 입력해 주세요.', '출산·입양 셋째 이상은 0~10명으로 입력해 주세요.'],
]

const employeeNotFound = () => new ApiError(404, '사원 정보를 찾을 수 없습니다.', {})
const inputLocked = () => new ApiError(409, '삭제된 사원의 연말정산 자료는 저장할 수 없습니다.', {})

const itemById = (id) => PAY_ITEMS.find((item) => item.id === id)
const pick = (source) => Object.fromEntries(INPUT_FIELDS.map((field) => [field, source[field]]))

/** 서버의 LocalDateTime 표기(시간대 없는 ISO)와 같은 모양의 현재 시각 */
function nowLocalDateTime() {
  const d = new Date()
  const p = (n, w = 2) => String(n).padStart(w, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`
}

// ---------- 경로·본문 읽기 (서버의 경로 변환 → 본문 읽기 → @Valid → 서비스 순서) ----------

/** 경로의 정수 값 (Integer·Long 변환과 같게, 정수가 아니면 형식 오류) */
function readPathInteger(raw, name) {
  if (!/^[+-]?\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw typeMismatch(name)
  return Number(raw)
}

/** YearEndService.validateYear */
function validateYear(year) {
  if (year < MIN_YEAR || year > MAX_YEAR) throw invalidInput({ year: '연도는 2000~2100 사이로 입력해 주세요.' })
  return year
}

/** 요청 본문: JSON 객체, 여부 항목은 true/false, 인원 항목은 정수만 읽을 수 있다(아니면 본문을 읽을 수 없음). */
function readInputBody(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw notReadable()
  for (const field of INPUT_FIELDS) {
    const value = body[field]
    if (value === undefined || value === null) continue
    if (BOOLEAN_FIELDS.includes(field) ? typeof value !== 'boolean' : !Number.isInteger(value)) throw notReadable()
  }
  const errors = {}
  for (const [field, requiredMessage, min, max, minMessage, maxMessage] of FIELD_RULES) {
    const value = body[field] ?? null
    if (value === null) errors[field] = requiredMessage
    else if (min !== undefined && value < min) errors[field] = minMessage
    else if (max !== undefined && value > max) errors[field] = maxMessage
  }
  if (Object.keys(errors).length > 0) throw invalidInput(errors)
  return pick(body)
}

// ---------- 저장소에서 필요한 값 꺼내기 ----------

/** 논리 삭제된 사원도 찾는다(조회·계산 허용). 없으면 404 */
function findEmployee(state, employeeId) {
  const employee = state.employees.find((e) => e.id === employeeId)
  if (!employee) throw employeeNotFound()
  return employee
}

const isDeleted = (employee) => employee.deletedAt !== null
const isResigned = (employee) => employee.employmentStatus === 'RESIGNED'
const findInput = (state, employeeId, year) => state.yearEndInputs.find((i) => i.employeeId === employeeId && i.taxYear === year) ?? null

/** 그 해·그 상태 기간의 급여: [{ payroll, month }], 사번 → 월 순 (서버 조회 순서와 같음) */
function payrollsIn(state, year, status) {
  const months = new Map(state.payrollPeriods.filter((p) => p.year === year && p.status === status).map((p) => [p.id, p.month]))
  return state.payrolls
    .filter((p) => months.has(p.periodId))
    .map((payroll) => ({ payroll, month: months.get(payroll.periodId) }))
    .sort((a, b) => byEmployeeNo(a.payroll, b.payroll) || a.month - b.month)
}

const totalsOf = (entries) => yearEndPayrollTotals(entries.map(({ payroll, month }) => ({ month, lines: payroll.lines })), itemById)

/** 계산기 호출 (입력 자료가 없으면 personal = null → 본인 기본공제만) */
function calculate(year, totals, input) {
  return calculateYearEnd({
    taxYear: year,
    totalSalary: totals.totalSalary,
    insurancePremium: totals.insurancePremium,
    pensionPremium: totals.nationalPension,
    prepaidTax: totals.incomeTax,
    personal: input === null ? null : pick(input),
  })
}

/** 입력 조회·저장 응답 (YearEndInputResponse.of) */
function inputResponse(year, employee, input) {
  const values = input === null ? SELF_ONLY : pick(input)
  const guide = childCreditAgeGuide(year)
  return {
    year,
    employeeId: employee.id,
    saved: input !== null,
    editable: !isDeleted(employee),
    ...pick(values),
    updatedAt: input === null ? null : input.updatedAt,
    childCreditMinimumAge: guide.minimumAge,
    childCreditAgeBasis: guide.basis,
    childCreditAgeCaution: guide.caution,
  }
}

// ---------- 처리 ----------

function listEmployees(store, year) {
  validateYear(year)
  const state = store.getState()
  const byEmployee = new Map()
  for (const entry of payrollsIn(state, year, 'CONFIRMED')) {
    const list = byEmployee.get(entry.payroll.employeeId) ?? []
    list.push(entry)
    byEmployee.set(entry.payroll.employeeId, list)
  }
  return [...byEmployee.values()].map((entries) => {
    const latest = entries[entries.length - 1].payroll
    const employee = findEmployee(state, latest.employeeId)
    const input = findInput(state, employee.id, year)
    const result = calculate(year, totalsOf(entries), input)
    return {
      employeeId: employee.id,
      employeeNo: latest.employeeNo,
      employeeName: latest.employeeName,
      department: latest.department,
      position: latest.position,
      deleted: isDeleted(employee),
      resigned: isResigned(employee),
      inputSaved: input !== null,
      payrollCount: entries.length,
      totalSalary: result.totalSalary,
      determinedTax: result.determinedTax,
      prepaidTax: result.prepaidTax,
      balance: result.balance,
      rulesYear: result.rulesYear,
    }
  })
}

function getInput(store, year, employeeId) {
  validateYear(year)
  const state = store.getState()
  const employee = findEmployee(state, employeeId)
  return inputResponse(year, employee, findInput(state, employee.id, year))
}

function saveInput(store, year, employeeId, body) {
  const values = readInputBody(body) // 서버에서는 @Valid 가 서비스보다 먼저 실행된다.
  validateYear(year)
  return store.update((state) => {
    const employee = findEmployee(state, employeeId)
    if (isDeleted(employee)) throw inputLocked()
    try {
      validatePersonalDeductionInput(values)
    } catch (error) {
      // 여러 항목에 걸친 규칙 위반 (배우자·한부모 동시 선택, 자녀 수 > 부양가족 등)
      if (error instanceof RangeError) throw invalidInput({ input: error.message })
      throw error
    }
    const existing = findInput(state, employee.id, year)
    if (existing === null) {
      const created = { employeeId: employee.id, taxYear: year, ...values, updatedAt: nowLocalDateTime() }
      state.yearEndInputs.push(created)
      return inputResponse(year, employee, created)
    }
    // 서버는 값이 바뀐 경우에만 수정 시각을 새로 기록한다(@PreUpdate).
    const changed = INPUT_FIELDS.some((field) => existing[field] !== values[field])
    Object.assign(existing, values)
    if (changed) existing.updatedAt = nowLocalDateTime()
    return inputResponse(year, employee, existing)
  })
}

const MEAL_WARNING = (months) => `식대가 월 20만원을 넘는 달이 있습니다(${months}). 비과세 한도 초과분의 과세 전환은 반영하지 않았습니다.`

function getResult(store, year, employeeId) {
  validateYear(year)
  const state = store.getState()
  const employee = findEmployee(state, employeeId)
  const confirmed = payrollsIn(state, year, 'CONFIRMED').filter((x) => x.payroll.employeeId === employee.id)
  const drafts = payrollsIn(state, year, 'DRAFT').filter((x) => x.payroll.employeeId === employee.id).length
  const input = findInput(state, employee.id, year)

  // 사원 정보: 그 해 마지막 확정 급여의 스냅샷, 없으면 현재 사원 정보
  const latest = confirmed.length > 0 ? confirmed[confirmed.length - 1].payroll : null
  const info = {
    employeeId: employee.id,
    employeeNo: latest ? latest.employeeNo : employee.employeeNo,
    employeeName: latest ? latest.employeeName : employee.name,
    department: latest ? latest.department : employee.department,
    position: latest ? latest.position : employee.position,
    deleted: isDeleted(employee),
    resigned: isResigned(employee),
  }

  const payrollWarnings = []
  if (drafts > 0) payrollWarnings.push(`작성 중인 급여 ${drafts}건은 계산에서 제외했습니다.`)
  if (info.resigned) payrollWarnings.push('퇴사한 사원입니다. 중도 퇴사자 정산 방식은 반영하지 않았습니다.')

  const base = { year, notice: NOTICE, employee: info }
  if (confirmed.length === 0) {
    return {
      ...base, calculable: false, inputSaved: input !== null, payrollCount: 0, excludedDraftPayrollCount: drafts,
      sources: null, calculation: null, warnings: ['확정된 급여가 없어 계산할 수 없습니다.', ...payrollWarnings], assumptions: [...ASSUMPTIONS],
    }
  }

  const totals = totalsOf(confirmed)
  const result = calculate(year, totals, input)
  const warnings = [...result.warnings]
  // 2017년생 연령 기준 주의(해석 미확정): 자녀세액공제 대상 자녀를 1명 이상 입력한 경우에만 안내한다.
  const childCaution = childCreditAgeGuide(year).caution
  if (childCaution !== null && input !== null && input.childCreditCount > 0) warnings.push(childCaution)
  if (totals.mealOverLimitMonths.length > 0) warnings.push(MEAL_WARNING(totals.mealOverLimitMonths.map((m) => `${m}월`).join(', ')))
  warnings.push(...payrollWarnings)

  return {
    ...base,
    calculable: true,
    inputSaved: input !== null,
    payrollCount: confirmed.length,
    excludedDraftPayrollCount: drafts,
    sources: {
      totalSalary: totals.totalSalary,
      nonTaxableEarnings: totals.nonTaxableEarnings,
      healthInsurance: totals.healthInsurance,
      longTermCare: totals.longTermCare,
      employmentInsurance: totals.employmentInsurance,
      nationalPension: totals.nationalPension,
      incomeTax: totals.incomeTax,
    },
    calculation: {
      rulesYear: result.rulesYear,
      totalSalary: result.totalSalary,
      earnedIncomeDeduction: result.earnedIncomeDeduction,
      earnedIncomeAmount: result.earnedIncomeAmount,
      basicDeduction: result.basicDeduction,
      additionalDeduction: result.additionalDeduction,
      personalDeduction: result.personalDeduction,
      insuranceDeduction: result.insuranceDeduction,
      pensionDeduction: result.pensionDeduction,
      taxBase: result.taxBase,
      calculatedTax: result.calculatedTax,
      earnedIncomeTaxCredit: result.earnedIncomeTaxCredit,
      childTaxCredit: result.childTaxCredit,
      birthAdoptionTaxCredit: result.birthAdoptionTaxCredit,
      standardTaxCredit: result.standardTaxCredit,
      taxCredit: result.taxCredit,
      determinedTax: result.determinedTax,
      prepaidTax: result.prepaidTax,
      balance: result.balance,
      additionalPayment: result.additionalPayment,
      refund: result.refund,
    },
    warnings,
    assumptions: result.assumptions,
  }
}

// ---------- 경로 연결 ----------

/** /api/year-end/{year}/employees[/{id}/input | /{id}/result] */
export function handleYearEnd(store, { method, segments, body }) {
  const isList = segments.length === 2 && segments[1] === 'employees'
  const isInput = segments.length === 4 && segments[1] === 'employees' && segments[3] === 'input'
  const isResult = segments.length === 4 && segments[1] === 'employees' && segments[3] === 'result'
  if (!isList && !isInput && !isResult) throw notFoundPath()
  if (isInput ? method !== 'GET' && method !== 'PUT' : method !== 'GET') throw methodNotAllowed()

  const year = readPathInteger(segments[0], 'year')
  if (isList) return listEmployees(store, year)
  const employeeId = readPathInteger(segments[2], 'employeeId')
  if (isResult) return getResult(store, year, employeeId)
  return method === 'GET' ? getInput(store, year, employeeId) : saveInput(store, year, employeeId, body)
}
