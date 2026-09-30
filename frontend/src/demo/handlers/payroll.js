// ------------------------------------------------------------------
// 체험 모드 급여 API (브라우저 저장소 사용, 네트워크 요청 없음, 포트폴리오용 시뮬레이션)
// 계약: docs/api/payroll-api.md 1~12 / 규칙 원본: 백엔드 PayrollPeriodService·PayrollService·Payroll·PayrollPeriod·요청 DTO
//   GET  /api/pay-items                               항목 12개 (표시 순서)
//   GET  /api/payroll-periods                         기간 목록 (최신 연월부터, 인원·합계)
//   POST /api/payroll-periods                         기간 생성 (작성 중)
//   GET  /api/payroll-periods/{id}                    기간 상세 + 사원별 급여 (사번 순)
//   PUT  /api/payroll-periods/{id}                    지급일 수정 (작성 중만)
//   POST /api/payroll-periods/{id}/confirm            확정 (급여 1건 이상)
//   POST /api/payroll-periods/{id}/reopen             확정 취소
//   GET  /api/payroll-periods/{id}/eligible-employees 입력 가능한 사원
//   POST /api/payroll-periods/{id}/payrolls           급여 입력
//   GET  /api/payrolls/{id}                           급여명세서
//   PUT  /api/payrolls/{id}                           급여 수정 (작성 중만)
//   DELETE /api/payrolls/{id}                         급여 삭제 (작성 중만, 실제 삭제)
// - 세금·보험료는 계산하지 않는다. 합계·실지급액만 항목 금액으로 계산한다.
// - 급여는 입력 당시 사원 정보(사번·이름·부서·직급)를 복사해 둔다. 항목 이름·과세 구분은 체험 모드에서 바뀌지 않는 고정 목록(PAY_ITEMS)을 쓴다.
// ------------------------------------------------------------------
import { ApiError, invalidInput, methodNotAllowed, notFoundPath, notReadable, typeMismatch } from '../errors.js'
import { PAY_ITEMS } from '../seed.js'

const MIN_YEAR = 2000
const MAX_YEAR = 2100
const MAX_LINES = 20
const MAX_LINE_AMOUNT = 1_000_000_000
const MEMO_MAX_LENGTH = 200
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const periodNotFound = () => new ApiError(404, '급여 기간을 찾을 수 없습니다.', {})
const periodDuplicated = () => new ApiError(409, '같은 연월의 급여 기간이 이미 있습니다.', {})
const periodConfirmed = () => new ApiError(409, '확정된 급여 기간은 변경할 수 없습니다. 확정을 취소한 뒤 수정해 주세요.', {})
const periodState = (message) => new ApiError(409, message, {})
const payrollNotFound = () => new ApiError(404, '급여 정보를 찾을 수 없습니다.', {})
const payrollDuplicated = () => new ApiError(409, '이 기간에 이미 급여가 입력된 사원입니다.', {})
const employeeNotFound = () => new ApiError(404, '사원 정보를 찾을 수 없습니다.', {})
const notEligible = (message = '해당 월에 재직한 사원만 급여를 입력할 수 있습니다.') => new ApiError(400, message, {})
const linesError = (message) => invalidInput({ lines: message })

export const itemById = (id) => PAY_ITEMS.find((item) => item.id === id)

function isRealDate(value) {
  if (!DATE_PATTERN.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/** 서버의 LocalDateTime 표기(시간대 없는 ISO)와 같은 모양의 현재 시각 */
function nowLocalDateTime() {
  const d = new Date()
  const p = (n, w = 2) => String(n).padStart(w, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`
}

function parseId(raw) {
  if (!/^-?\d+$/.test(raw)) throw typeMismatch('id')
  const id = Number(raw)
  if (!Number.isSafeInteger(id)) throw typeMismatch('id')
  return id
}

// ---------- 계산 ----------

/** 급여 한 건의 합계 (0원 항목은 저장하지 않으므로 모든 항목이 대상). 연간 집계(payrollSummary.js)도 사용 */
export function totalsOf(payroll) {
  let earnings = 0
  let deductions = 0
  for (const line of payroll.lines) {
    const item = itemById(line.payItemId)
    if (item?.category === 'EARNING') earnings += line.amount
    else deductions += line.amount
  }
  return { totalEarnings: earnings, totalDeductions: deductions, netPay: earnings - deductions }
}

export const byEmployeeNo = (a, b) => (a.employeeNo < b.employeeNo ? -1 : a.employeeNo > b.employeeNo ? 1 : 0)
const payrollsOf = (state, periodId) => state.payrolls.filter((p) => p.periodId === periodId).sort(byEmployeeNo)

function periodSummary(period, payrolls) {
  let totalEarnings = 0
  let totalDeductions = 0
  let totalNetPay = 0
  for (const p of payrolls) {
    const t = totalsOf(p)
    totalEarnings += t.totalEarnings
    totalDeductions += t.totalDeductions
    totalNetPay += t.netPay
  }
  return {
    id: period.id,
    year: period.year,
    month: period.month,
    paymentDate: period.paymentDate,
    status: period.status,
    confirmedAt: period.confirmedAt,
    payrollCount: payrolls.length,
    totalEarnings,
    totalDeductions,
    totalNetPay,
  }
}

function payrollSummary(p) {
  return {
    id: p.id,
    employeeId: p.employeeId,
    employeeNo: p.employeeNo,
    employeeName: p.employeeName,
    department: p.department,
    position: p.position,
    ...totalsOf(p),
  }
}

function payrollDetail(state, p) {
  const period = state.payrollPeriods.find((x) => x.id === p.periodId)
  const lines = p.lines
    .map((line) => ({ line, item: itemById(line.payItemId) }))
    .sort((a, b) => a.item.sortOrder - b.item.sortOrder)
  const toLine = ({ line, item }) => ({ payItemId: item.id, itemName: item.name, taxType: item.taxType, amount: line.amount })
  return {
    id: p.id,
    period: { id: period.id, year: period.year, month: period.month, paymentDate: period.paymentDate, status: period.status },
    employeeId: p.employeeId,
    employeeNo: p.employeeNo,
    employeeName: p.employeeName,
    department: p.department,
    position: p.position,
    earnings: lines.filter((x) => x.item.category === 'EARNING').map(toLine),
    deductions: lines.filter((x) => x.item.category === 'DEDUCTION').map(toLine),
    ...totalsOf(p),
    memo: p.memo,
  }
}

/** 해당 월 재직: 삭제 안 됨 + 입사일 ≤ 말일 + (퇴사일 없음 또는 퇴사일 ≥ 1일) */
function isEligible(employee, year, month) {
  if (employee.deletedAt !== null) return false
  const mm = String(month).padStart(2, '0')
  const firstDay = `${year}-${mm}-01`
  const lastDay = `${year}-${mm}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, '0')}`
  return employee.hireDate <= lastDay && (employee.resignationDate === null || employee.resignationDate >= firstDay)
}

// ---------- 요청 본문 검사 (서버의 JSON 읽기 + @Valid 단계) ----------

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isIntegerOrNull = (v) => v === undefined || v === null || Number.isInteger(v)

function readPeriodCreate(body) {
  if (!isObject(body)) throw notReadable()
  if (!isIntegerOrNull(body.year) || !isIntegerOrNull(body.month)) throw notReadable()
  const paymentDate = body.paymentDate ?? null
  if (paymentDate !== null && (typeof paymentDate !== 'string' || !isRealDate(paymentDate))) throw notReadable()
  const year = body.year ?? null
  const month = body.month ?? null
  const errors = {}
  if (year === null) errors.year = '연도를 입력해 주세요.'
  else if (year < MIN_YEAR || year > MAX_YEAR) errors.year = '연도는 2000~2100 사이로 입력해 주세요.'
  if (month === null) errors.month = '월을 입력해 주세요.'
  else if (month < 1 || month > 12) errors.month = '월은 1~12 사이로 입력해 주세요.'
  if (paymentDate === null) errors.paymentDate = '지급일을 입력해 주세요.'
  if (Object.keys(errors).length > 0) throw invalidInput(errors)
  return { year, month, paymentDate }
}

function readPeriodUpdate(body) {
  if (!isObject(body)) throw notReadable()
  const paymentDate = body.paymentDate ?? null
  if (paymentDate !== null && (typeof paymentDate !== 'string' || !isRealDate(paymentDate))) throw notReadable()
  if (paymentDate === null) throw invalidInput({ paymentDate: '지급일을 입력해 주세요.' })
  return { paymentDate }
}

/** 급여 입력·수정 본문. withEmployee: 입력(POST)만 employeeId 를 읽는다. */
function readPayrollBody(body, { withEmployee }) {
  if (!isObject(body)) throw notReadable()
  if (withEmployee && !isIntegerOrNull(body.employeeId)) throw notReadable()
  if (body.lines !== undefined && body.lines !== null && !Array.isArray(body.lines)) throw notReadable()
  if (body.memo !== undefined && body.memo !== null && typeof body.memo !== 'string') throw notReadable()
  const lines = body.lines ?? null
  for (const line of lines ?? []) {
    if (line === null) continue
    if (!isObject(line) || !isIntegerOrNull(line.payItemId) || !isIntegerOrNull(line.amount)) throw notReadable()
  }
  const errors = {}
  const put = (field, message) => {
    if (!(field in errors)) errors[field] = message
  }
  if (withEmployee && (body.employeeId ?? null) === null) put('employeeId', '사원을 선택해 주세요.')
  if (lines === null || lines.length === 0) put('lines', '급여 항목을 입력해 주세요.')
  else if (lines.length > MAX_LINES) put('lines', '급여 항목은 20개 이하로 입력해 주세요.')
  ;(lines ?? []).forEach((line, i) => {
    if (line === null) return put(`lines[${i}]`, '급여 항목을 입력해 주세요.')
    if ((line.payItemId ?? null) === null) put(`lines[${i}].payItemId`, '항목을 선택해 주세요.')
    if ((line.amount ?? null) === null) put(`lines[${i}].amount`, '금액을 입력해 주세요.')
    else if (line.amount < 0) put(`lines[${i}].amount`, '금액은 0원 이상으로 입력해 주세요.')
    else if (line.amount > MAX_LINE_AMOUNT) put(`lines[${i}].amount`, '항목 금액은 1,000,000,000원 이하로 입력해 주세요.')
  })
  const memo = body.memo ?? null
  if (memo !== null && memo.length > MEMO_MAX_LENGTH) put('memo', '메모는 200자 이하로 입력해 주세요.')
  if (Object.keys(errors).length > 0) throw invalidInput(errors)
  return { employeeId: withEmployee ? body.employeeId : undefined, lines, memo }
}

/** 항목 규칙: 없는 항목 → 중복 → 금액 범위 → 1원 이상만 저장 → 지급 합계 > 0 → 공제 ≤ 지급 (서버와 같은 순서·문구) */
function acceptLines(lines) {
  const items = lines.map((line) => itemById(line.payItemId))
  const missing = lines.find((line, i) => !items[i])
  if (missing) throw linesError(`존재하지 않는 항목입니다: ${missing.payItemId}`)
  const seen = new Set()
  const accepted = []
  lines.forEach((line, i) => {
    const item = items[i]
    if (seen.has(item.code)) throw linesError(`같은 항목을 두 번 입력할 수 없습니다: ${item.name}`)
    seen.add(item.code)
    const amount = line.amount ?? 0
    if (amount < 0) throw linesError(`금액은 0원 이상으로 입력해 주세요: ${item.name}`)
    if (amount > MAX_LINE_AMOUNT) throw linesError(`항목 금액은 1,000,000,000원 이하로 입력해 주세요: ${item.name}`)
    if (amount > 0) accepted.push({ payItemId: item.id, amount })
  })
  const t = totalsOf({ lines: accepted })
  if (t.totalEarnings <= 0) throw linesError('지급 항목을 1개 이상 입력해 주세요.')
  if (t.totalDeductions > t.totalEarnings) {
    throw linesError('공제 합계가 지급 합계보다 클 수 없습니다. 실지급액은 0원 이상이어야 합니다.')
  }
  return accepted
}

const normalizeMemo = (memo) => (memo === null || memo.trim() === '' ? null : memo.trim())

// ---------- 처리 ----------

function findPeriod(state, id) {
  const period = state.payrollPeriods.find((p) => p.id === id)
  if (!period) throw periodNotFound()
  return period
}

function findPayroll(state, id) {
  const payroll = state.payrolls.find((p) => p.id === id)
  if (!payroll) throw payrollNotFound()
  return payroll
}

function listPeriods(store) {
  const state = store.getState()
  return [...state.payrollPeriods]
    .sort((a, b) => b.year - a.year || b.month - a.month)
    .map((period) => periodSummary(period, payrollsOf(state, period.id)))
}

function createPeriod(store, body) {
  const input = readPeriodCreate(body)
  return store.update((state) => {
    if (state.payrollPeriods.some((p) => p.year === input.year && p.month === input.month)) throw periodDuplicated()
    const period = { id: state.nextIds.payrollPeriod, year: input.year, month: input.month, paymentDate: input.paymentDate, status: 'DRAFT', confirmedAt: null }
    state.nextIds.payrollPeriod += 1
    state.payrollPeriods.push(period)
    return periodSummary(period, [])
  })
}

function periodDetail(store, id) {
  const state = store.getState()
  const period = findPeriod(state, id)
  const payrolls = payrollsOf(state, id)
  return { ...periodSummary(period, payrolls), payrolls: payrolls.map(payrollSummary) }
}

function updatePeriod(store, id, body) {
  const input = readPeriodUpdate(body)
  return store.update((state) => {
    const period = findPeriod(state, id)
    if (period.status === 'CONFIRMED') throw periodConfirmed()
    period.paymentDate = input.paymentDate
    return periodSummary(period, payrollsOf(state, id))
  })
}

function confirmPeriod(store, id) {
  return store.update((state) => {
    const period = findPeriod(state, id)
    if (period.status === 'CONFIRMED') throw periodState('이미 확정된 급여 기간입니다.')
    const payrolls = payrollsOf(state, id)
    if (payrolls.length === 0) throw periodState('급여 내역이 1건 이상 있어야 확정할 수 있습니다.')
    period.status = 'CONFIRMED'
    period.confirmedAt = nowLocalDateTime()
    return periodSummary(period, payrolls)
  })
}

function reopenPeriod(store, id) {
  return store.update((state) => {
    const period = findPeriod(state, id)
    if (period.status !== 'CONFIRMED') throw periodState('확정되지 않은 급여 기간입니다.')
    period.status = 'DRAFT'
    period.confirmedAt = null
    return periodSummary(period, payrollsOf(state, id))
  })
}

function eligibleEmployees(store, id) {
  const state = store.getState()
  const period = findPeriod(state, id)
  const paid = new Set(payrollsOf(state, id).map((p) => p.employeeId))
  return state.employees
    .filter((e) => e.deletedAt === null && isEligible(e, period.year, period.month) && !paid.has(e.id))
    .sort(byEmployeeNo)
    .map((e) => ({ id: e.id, employeeNo: e.employeeNo, name: e.name, department: e.department, position: e.position, employmentStatus: e.employmentStatus }))
}

function createPayroll(store, periodId, body) {
  const input = readPayrollBody(body, { withEmployee: true })
  return store.update((state) => {
    const period = findPeriod(state, periodId)
    if (period.status === 'CONFIRMED') throw periodConfirmed()
    const employee = state.employees.find((e) => e.id === input.employeeId)
    if (!employee) throw employeeNotFound()
    if (employee.deletedAt !== null) throw notEligible('삭제된 사원에게는 급여를 입력할 수 없습니다.')
    if (!isEligible(employee, period.year, period.month)) throw notEligible()
    if (state.payrolls.some((p) => p.periodId === periodId && p.employeeId === employee.id)) throw payrollDuplicated()
    const lines = acceptLines(input.lines)
    const payroll = {
      id: state.nextIds.payroll,
      periodId,
      employeeId: employee.id,
      employeeNo: employee.employeeNo,
      employeeName: employee.name,
      department: employee.department,
      position: employee.position,
      lines,
      memo: normalizeMemo(input.memo),
    }
    state.nextIds.payroll += 1
    state.payrolls.push(payroll)
    return payrollDetail(state, payroll)
  })
}

function getPayroll(store, id) {
  const state = store.getState()
  return payrollDetail(state, findPayroll(state, id))
}

function updatePayroll(store, id, body) {
  const input = readPayrollBody(body, { withEmployee: false })
  return store.update((state) => {
    const payroll = findPayroll(state, id)
    if (findPeriod(state, payroll.periodId).status === 'CONFIRMED') throw periodConfirmed()
    payroll.lines = acceptLines(input.lines)
    payroll.memo = normalizeMemo(input.memo)
    return payrollDetail(state, payroll)
  })
}

function deletePayroll(store, id) {
  store.update((state) => {
    const payroll = findPayroll(state, id)
    if (findPeriod(state, payroll.periodId).status === 'CONFIRMED') throw periodConfirmed()
    state.payrolls = state.payrolls.filter((p) => p.id !== id)
  })
  return null // 204 본문 없음
}

// ---------- 경로 연결 ----------

/** /api/pay-items */
export function handlePayItems(store, { method, segments }) {
  if (segments.length > 0) throw notFoundPath()
  if (method !== 'GET') throw methodNotAllowed()
  return PAY_ITEMS.map((item) => ({ ...item }))
}

/** /api/payroll-periods/... */
export function handlePayrollPeriods(store, { method, segments, body }) {
  if (segments.length === 0) {
    if (method === 'GET') return listPeriods(store)
    if (method === 'POST') return createPeriod(store, body)
    throw methodNotAllowed()
  }
  const id = parseId(segments[0])
  if (segments.length === 1) {
    if (method === 'GET') return periodDetail(store, id)
    if (method === 'PUT') return updatePeriod(store, id, body)
    throw methodNotAllowed()
  }
  if (segments.length === 2) {
    const action = segments[1]
    if (action === 'confirm') { if (method === 'POST') return confirmPeriod(store, id); throw methodNotAllowed() }
    if (action === 'reopen') { if (method === 'POST') return reopenPeriod(store, id); throw methodNotAllowed() }
    if (action === 'eligible-employees') { if (method === 'GET') return eligibleEmployees(store, id); throw methodNotAllowed() }
    if (action === 'payrolls') { if (method === 'POST') return createPayroll(store, id, body); throw methodNotAllowed() }
  }
  throw notFoundPath()
}

/** /api/payrolls/{id} */
export function handlePayrolls(store, { method, segments, body }) {
  if (segments.length !== 1) throw notFoundPath()
  const id = parseId(segments[0])
  if (method === 'GET') return getPayroll(store, id)
  if (method === 'PUT') return updatePayroll(store, id, body)
  if (method === 'DELETE') return deletePayroll(store, id)
  throw methodNotAllowed()
}
