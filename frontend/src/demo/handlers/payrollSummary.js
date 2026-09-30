// ------------------------------------------------------------------
// 체험 모드 연간 급여 집계 API (브라우저 저장소 사용, 네트워크 요청 없음, 포트폴리오용 시뮬레이션, 조회만)
// 계약: docs/api/payroll-api.md 14·15 / 규칙 원본: 백엔드 PayrollSummaryService·AnnualTotals·Annual*Response
//   GET /api/payroll-summaries/annual?year=                  연간 집계 (확정 기간만, 사원별 합계)
//   GET /api/payroll-summaries/annual/employees/{id}?year=   사원별 연간 상세 (월별·항목별)
// - 귀속 연도(기간의 year) 기준, 확정(CONFIRMED)된 기간의 급여만 합산한다. 작성 중 기간은 제외하고 그 수를 알려 준다.
// - 과세·비과세는 항목의 과세 구분으로 나눈다. 비과세 한도(식대 월 20만원 등)는 검사하지 않는다.
// - 사원 정보는 그 해 마지막 확정 급여에 복사해 둔 값이다. 논리 삭제된 사원도 포함하고 deleted 로 표시한다.
// ------------------------------------------------------------------
import { ApiError, invalidInput, methodNotAllowed, notFoundPath, typeMismatch } from '../errors.js'
import { byEmployeeNo, itemById, totalsOf } from './payroll.js'

const MIN_YEAR = 2000
const MAX_YEAR = 2100

const employeeNotFound = () => new ApiError(404, '사원 정보를 찾을 수 없습니다.', {})

/** 서버의 정수 파라미터 읽기와 같게: 없거나 빈 값 → "값을 입력해 주세요.", 정수가 아님 → 형식 오류 */
function readInteger(raw, name) {
  if (raw === null || raw.trim() === '') throw invalidInput({ [name]: '값을 입력해 주세요.' })
  if (!/^[+-]?\d+$/.test(raw)) throw typeMismatch(name)
  const value = Number(raw)
  if (!Number.isSafeInteger(value)) throw typeMismatch(name)
  return value
}

function readYear(searchParams) {
  const year = readInteger(searchParams.get('year'), 'year')
  if (year < MIN_YEAR || year > MAX_YEAR) throw invalidInput({ year: '연도는 2000~2100 사이로 입력해 주세요.' })
  return year
}

const ZERO = { totalEarnings: 0, taxableEarnings: 0, nonTaxableEarnings: 0, totalDeductions: 0, netPay: 0 }

/** 급여 한 건의 연간 집계용 합계 (지급 = 과세 + 비과세) */
function annualTotalsOf(payroll) {
  let taxable = 0
  let nonTaxable = 0
  for (const line of payroll.lines) {
    const item = itemById(line.payItemId)
    if (item.category !== 'EARNING') continue
    if (item.taxType === 'TAXABLE') taxable += line.amount
    else if (item.taxType === 'NON_TAXABLE') nonTaxable += line.amount
  }
  const { totalEarnings, totalDeductions, netPay } = totalsOf(payroll)
  return { totalEarnings, taxableEarnings: taxable, nonTaxableEarnings: nonTaxable, totalDeductions, netPay }
}

function sumTotals(list) {
  return list.reduce((sum, t) => ({
    totalEarnings: sum.totalEarnings + t.totalEarnings,
    taxableEarnings: sum.taxableEarnings + t.taxableEarnings,
    nonTaxableEarnings: sum.nonTaxableEarnings + t.nonTaxableEarnings,
    totalDeductions: sum.totalDeductions + t.totalDeductions,
    netPay: sum.netPay + t.netPay,
  }), { ...ZERO })
}

/** 그 해·그 상태 기간의 급여 (급여 + 기간). 사번 → 월 순 (서버 조회 순서와 같음) */
function payrollsIn(state, year, status) {
  const periods = new Map(state.payrollPeriods.filter((p) => p.year === year && p.status === status).map((p) => [p.id, p]))
  return state.payrolls
    .filter((p) => periods.has(p.periodId))
    .map((payroll) => ({ payroll, period: periods.get(payroll.periodId) }))
    .sort((a, b) => byEmployeeNo(a.payroll, b.payroll) || a.period.month - b.period.month)
}

const isDeleted = (state, employeeId) => state.employees.find((e) => e.id === employeeId)?.deletedAt != null

function annualSummary(store, searchParams) {
  const year = readYear(searchParams)
  const state = store.getState()
  const byEmployee = new Map()
  for (const entry of payrollsIn(state, year, 'CONFIRMED')) {
    const list = byEmployee.get(entry.payroll.employeeId) ?? []
    list.push(entry.payroll)
    byEmployee.set(entry.payroll.employeeId, list)
  }
  const employees = [...byEmployee.values()].map((payrolls) => {
    const latest = payrolls[payrolls.length - 1]
    return {
      employeeId: latest.employeeId,
      employeeNo: latest.employeeNo,
      employeeName: latest.employeeName,
      department: latest.department,
      position: latest.position,
      deleted: isDeleted(state, latest.employeeId),
      payrollCount: payrolls.length,
      totals: sumTotals(payrolls.map(annualTotalsOf)),
    }
  })
  const countPeriods = (status) => state.payrollPeriods.filter((p) => p.year === year && p.status === status).length
  return {
    year,
    confirmedPeriodCount: countPeriods('CONFIRMED'),
    excludedDraftPeriodCount: countPeriods('DRAFT'),
    totals: sumTotals(employees.map((e) => e.totals)),
    employees,
  }
}

/** 항목별 연간 합계, 항목 표시 순서 */
function itemTotals(payrolls) {
  const sums = new Map()
  for (const payroll of payrolls) {
    for (const line of payroll.lines) sums.set(line.payItemId, (sums.get(line.payItemId) ?? 0) + line.amount)
  }
  return [...sums.entries()]
    .map(([payItemId, amount]) => ({ item: itemById(payItemId), amount }))
    .sort((a, b) => a.item.sortOrder - b.item.sortOrder)
    .map(({ item, amount }) => ({ payItemId: item.id, itemName: item.name, category: item.category, taxType: item.taxType, amount }))
}

function employeeAnnual(store, rawEmployeeId, searchParams) {
  if (!/^-?\d+$/.test(rawEmployeeId) || !Number.isSafeInteger(Number(rawEmployeeId))) throw typeMismatch('employeeId')
  const year = readYear(searchParams)
  const employeeId = Number(rawEmployeeId)
  const state = store.getState()
  const employee = state.employees.find((e) => e.id === employeeId)
  if (!employee) throw employeeNotFound()

  const confirmed = payrollsIn(state, year, 'CONFIRMED').filter((x) => x.payroll.employeeId === employeeId)
  const excludedDraftPayrollCount = payrollsIn(state, year, 'DRAFT').filter((x) => x.payroll.employeeId === employeeId).length
  const months = confirmed.map(({ payroll, period }) => ({
    payrollId: payroll.id,
    month: period.month,
    paymentDate: period.paymentDate,
    ...annualTotalsOf(payroll),
  }))
  const deleted = employee.deletedAt !== null
  if (confirmed.length === 0) {
    // 확정 급여가 없으면 현재 사원 정보와 합계 0
    return {
      year, employeeId, employeeNo: employee.employeeNo, employeeName: employee.name, department: employee.department,
      position: employee.position, deleted, excludedDraftPayrollCount, totals: { ...ZERO }, months, items: [],
    }
  }
  const latest = confirmed[confirmed.length - 1].payroll
  const payrolls = confirmed.map((x) => x.payroll)
  return {
    year, employeeId, employeeNo: latest.employeeNo, employeeName: latest.employeeName, department: latest.department,
    position: latest.position, deleted, excludedDraftPayrollCount,
    totals: sumTotals(payrolls.map(annualTotalsOf)), months, items: itemTotals(payrolls),
  }
}

// ---------- 경로 연결 ----------

/** /api/payroll-summaries/annual[/employees/{id}] */
export function handlePayrollSummaries(store, { method, segments, searchParams }) {
  const isSummary = segments.length === 1 && segments[0] === 'annual'
  const isEmployee = segments.length === 3 && segments[0] === 'annual' && segments[1] === 'employees'
  if (!isSummary && !isEmployee) throw notFoundPath()
  if (method !== 'GET') throw methodNotAllowed()
  return isSummary ? annualSummary(store, searchParams) : employeeAnnual(store, segments[2], searchParams)
}
