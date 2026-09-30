// 체험 모드 연말정산 API 테스트 (실행: npm test) — 화면이 쓰는 것과 같은 경로로 가짜 서버를 부른다 (모의 계산, 가상 금액)
// 초기 데이터 금액 기대값은 백엔드 Java 계산기 결과(yearend/seedScenario.test.js 와 같은 값)다.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '../errors.js'
import { handleDemoRequest } from '../router.js'
import { createSeedData } from '../seed.js'
import { createDemoStore, STORAGE_KEY } from '../storage.js'
import { ASSUMPTIONS } from '../yearend/calculator.js'
import { childCreditAgeGuide } from '../yearend/childCreditAgeGuide.js'
import { RULE_NOTE_2026 } from '../yearend/taxRules.js'
import { NOTICE } from './yearend.js'

function fakeStorage() {
  const data = new Map()
  return { data, getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k) }
}

function setup() {
  const storage = fakeStorage()
  const store = createDemoStore({ storage })
  return { storage, store, call: (path, options) => handleDemoRequest(store, path, options) }
}

function expectError(fn, status, { message, fieldErrors } = {}) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof ApiError, `ApiError 가 아님: ${error}`)
    assert.equal(error.status, status, `status ${error.status} message ${error.message}`)
    if (message !== undefined) assert.equal(error.message, message)
    if (fieldErrors !== undefined) assert.deepEqual(error.fieldErrors, fieldErrors)
    return true
  })
}

const FIELDS = ['spouseDeduction', 'dependentCount', 'elderlyCount', 'disabledCount', 'womanDeduction', 'singleParentDeduction', 'childCreditCount', 'birthFirstCount', 'birthSecondCount', 'birthThirdPlusCount']
const values = (...v) => Object.fromEntries(FIELDS.map((k, i) => [k, v[i]]))
const DEMO002_SEED = values(true, 1, 0, 0, false, false, 1, 0, 0, 0)
const SELF = values(false, 0, 0, 0, false, false, 0, 0, 0, 0)
const put = (body) => ({ method: 'PUT', body })
const CHILD_CAUTION = childCreditAgeGuide(2026).caution
const NO_INPUT = '연말정산 입력 자료가 없어 본인 기본공제만 적용했습니다.'
const DRAFT_1 = '작성 중인 급여 1건은 계산에서 제외했습니다.'
const RESIGNED = '퇴사한 사원입니다. 중도 퇴사자 정산 방식은 반영하지 않았습니다.'
const saved = (storage) => JSON.parse(storage.data.get(STORAGE_KEY))

// [사번, 총급여, 결정세액, 기납부세액, 차액] — 백엔드 Java 계산 결과 (2026년 1~8월 확정 급여)
const SEED_SUMMARY = [
  ['DEMO001', 25_500_000, 346_815, 920_000, -573_185],
  ['DEMO002', 30_600_000, 139_070, 1_640_000, -1_500_930],
  ['DEMO003', 22_950_000, 292_181, 640_000, -347_819],
  ['DEMO004', 27_200_000, 377_000, 570_000, -193_000],
  ['DEMO005', 22_100_000, 272_151, 200_000, 72_151],
  ['DEMO006', 24_000_000, 307_612, 1_500_000, -1_192_388],
  ['DEMO007', 23_800_000, 307_085, 370_000, -62_915],
  ['DEMO008', 21_250_000, 254_658, 190_000, 64_658],
]

test('목록 2026: 확정 급여가 있는 8명 사번 순, 계산 요약이 백엔드 계산과 같고 입력 저장 여부·퇴사 표시', () => {
  const { call } = setup()
  const list = call('/api/year-end/2026/employees')
  assert.deepEqual(Object.keys(list[0]), ['employeeId', 'employeeNo', 'employeeName', 'department', 'position', 'deleted', 'resigned', 'inputSaved', 'payrollCount', 'totalSalary', 'determinedTax', 'prepaidTax', 'balance', 'rulesYear'])
  assert.deepEqual(list.map((e) => [e.employeeNo, e.totalSalary, e.determinedTax, e.prepaidTax, e.balance]), SEED_SUMMARY)
  assert.deepEqual(list.filter((e) => e.inputSaved).map((e) => e.employeeNo), ['DEMO002'])
  assert.deepEqual(list.filter((e) => e.resigned).map((e) => e.employeeNo), ['DEMO006'])
  assert.deepEqual(list.map((e) => e.payrollCount), [8, 8, 8, 8, 8, 6, 8, 8])
  assert.ok(list.every((e) => e.rulesYear === 2026 && e.deleted === false))
  assert.deepEqual(list[1], { employeeId: 2, employeeNo: 'DEMO002', employeeName: '가상이', department: '재무팀', position: '과장', deleted: false, resigned: false, inputSaved: true, payrollCount: 8, totalSalary: 30_600_000, determinedTax: 139_070, prepaidTax: 1_640_000, balance: -1_500_930, rulesYear: 2026 })
})

test('입력 조회: DEMO002 는 초기 데이터 입력(배우자·부양가족 1·자녀 1), 2026년 연령 안내(9세, 2017년생 주의)', () => {
  const { call } = setup()
  const input = call('/api/year-end/2026/employees/2/input')
  assert.deepEqual(Object.keys(input), ['year', 'employeeId', 'saved', 'editable', ...FIELDS, 'updatedAt', 'childCreditMinimumAge', 'childCreditAgeBasis', 'childCreditAgeCaution'])
  assert.deepEqual(input, {
    year: 2026, employeeId: 2, saved: true, editable: true, ...DEMO002_SEED, updatedAt: '2026-09-01T09:00:00.000',
    childCreditMinimumAge: 9, childCreditAgeBasis: childCreditAgeGuide(2026).basis, childCreditAgeCaution: CHILD_CAUTION,
  })
  // 저장된 자료가 없으면 saved=false 와 기본값(본인만), 2025년은 8세·주의 없음
  assert.deepEqual(call('/api/year-end/2025/employees/1/input'), {
    year: 2025, employeeId: 1, saved: false, editable: true, ...SELF, updatedAt: null,
    childCreditMinimumAge: 8, childCreditAgeBasis: childCreditAgeGuide(2025).basis, childCreditAgeCaution: null,
  })
})

test('결과 DEMO002: 입력 자료 반영(기본공제 3명·자녀세액공제), 급여 합계, 경고(2026 규칙·2017년생 주의·작성 중 1건 제외)', () => {
  const { call } = setup()
  const r = call('/api/year-end/2026/employees/2/result')
  assert.deepEqual(Object.keys(r), ['year', 'notice', 'employee', 'calculable', 'inputSaved', 'payrollCount', 'excludedDraftPayrollCount', 'sources', 'calculation', 'warnings', 'assumptions'])
  assert.deepEqual([r.year, r.notice, r.calculable, r.inputSaved, r.payrollCount, r.excludedDraftPayrollCount], [2026, NOTICE, true, true, 8, 1])
  assert.equal(NOTICE, '모의 계산 · 전문가 검증 전 · 지방소득세 미포함')
  assert.deepEqual(r.employee, { employeeId: 2, employeeNo: 'DEMO002', employeeName: '가상이', department: '재무팀', position: '과장', deleted: false, resigned: false })
  assert.deepEqual(r.sources, { totalSalary: 30_600_000, nonTaxableEarnings: 1_600_000, healthInsurance: 600_000, longTermCare: 40_000, employmentInsurance: 160_000, nationalPension: 1_296_000, incomeTax: 1_640_000 })
  assert.deepEqual(r.calculation, {
    rulesYear: 2026, totalSalary: 30_600_000, earnedIncomeDeduction: 9_840_000, earnedIncomeAmount: 20_760_000,
    basicDeduction: 4_500_000, additionalDeduction: { elderly: 0, disabled: 0, woman: 0, singleParent: 0 },
    personalDeduction: { requested: 4_500_000, applied: 4_500_000 }, insuranceDeduction: { requested: 800_000, applied: 800_000 },
    pensionDeduction: { requested: 1_296_000, applied: 1_296_000 }, taxBase: 14_164_000, calculatedTax: 864_600,
    earnedIncomeTaxCredit: 475_530, childTaxCredit: 250_000, birthAdoptionTaxCredit: 0, standardTaxCredit: 0,
    taxCredit: { requested: 725_530, applied: 725_530 }, determinedTax: 139_070, prepaidTax: 1_640_000,
    balance: -1_500_930, additionalPayment: 0, refund: 1_500_930,
  })
  assert.deepEqual(r.warnings, [RULE_NOTE_2026, CHILD_CAUTION, DRAFT_1])
  assert.deepEqual(r.assumptions, ASSUMPTIONS)
})

test('환급·추가 납부: DEMO001 환급 573,185원 / DEMO005 추가 납부 72,151원 / DEMO008 추가 납부 64,658원', () => {
  const { call } = setup()
  const refund = call('/api/year-end/2026/employees/1/result').calculation
  assert.deepEqual([refund.balance, refund.refund, refund.additionalPayment], [-573_185, 573_185, 0])
  const pay5 = call('/api/year-end/2026/employees/5/result')
  assert.deepEqual([pay5.calculation.balance, pay5.calculation.additionalPayment, pay5.calculation.refund], [72_151, 72_151, 0])
  assert.deepEqual(pay5.warnings, [RULE_NOTE_2026, NO_INPUT]) // DEMO005 는 9월 급여가 없어 작성 중 제외 안내 없음
  assert.equal(call('/api/year-end/2026/employees/8/result').calculation.additionalPayment, 64_658)
  // 목록과 결과 화면의 금액이 같다
  const list = call('/api/year-end/2026/employees')
  for (const row of list) {
    const c = call(`/api/year-end/2026/employees/${row.employeeId}/result`).calculation
    assert.deepEqual([c.totalSalary, c.determinedTax, c.prepaidTax, c.balance], [row.totalSalary, row.determinedTax, row.prepaidTax, row.balance], row.employeeNo)
  }
})

test('퇴사자 DEMO006: 1~6월로 계산, 경고(2026 규칙·입력 없음·퇴사자)', () => {
  const { call } = setup()
  const r = call('/api/year-end/2026/employees/6/result')
  assert.deepEqual([r.payrollCount, r.excludedDraftPayrollCount, r.employee.resigned, r.calculation.balance], [6, 0, true, -1_192_388])
  assert.deepEqual(r.warnings, [RULE_NOTE_2026, NO_INPUT, RESIGNED])
})

test('계산 결과는 저장된 급여 데이터와 일치: 급여 합계 = 연간 집계, 9월 확정 후 9개월로 재계산', () => {
  const { call } = setup()
  const annual = call('/api/payroll-summaries/annual?year=2026').employees
  for (const row of annual) {
    const r = call(`/api/year-end/2026/employees/${row.employeeId}/result`)
    const detail = call(`/api/payroll-summaries/annual/employees/${row.employeeId}?year=2026`)
    const item = (name) => detail.items.find((i) => i.itemName === name)?.amount ?? 0
    assert.equal(r.sources.totalSalary, row.totals.taxableEarnings, row.employeeNo)
    assert.equal(r.sources.nonTaxableEarnings, row.totals.nonTaxableEarnings, row.employeeNo)
    assert.deepEqual([r.sources.incomeTax, r.sources.nationalPension, r.sources.healthInsurance, r.sources.longTermCare, r.sources.employmentInsurance],
      [item('소득세'), item('국민연금'), item('건강보험'), item('장기요양보험'), item('고용보험')], row.employeeNo)
    assert.equal(r.payrollCount, row.payrollCount)
  }
  call('/api/payroll-periods/1/confirm', { method: 'POST' })
  const r = call('/api/year-end/2026/employees/1/result')
  assert.deepEqual([r.payrollCount, r.excludedDraftPayrollCount, r.sources.totalSalary, r.sources.incomeTax], [9, 0, 28_500_000, 1_020_000])
  assert.ok(!r.warnings.includes(DRAFT_1))
})

test('입력 저장: DEMO002 수정 → 결과에 바로 반영, 저장 구조 유지, 새로고침(새 저장소 객체) 후에도 유지', () => {
  const { call, storage } = setup()
  // 자녀세액공제 대상 1 → 0: 자녀세액공제 25만원이 빠지고 2017년생 주의도 사라진다
  const changed = { ...DEMO002_SEED, childCreditCount: 0 }
  const response = call('/api/year-end/2026/employees/2/input', put(changed))
  assert.deepEqual([response.saved, response.childCreditCount], [true, 0])
  assert.match(response.updatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}$/)
  assert.notEqual(response.updatedAt, '2026-09-01T09:00:00.000')
  const r = call('/api/year-end/2026/employees/2/result')
  assert.deepEqual([r.calculation.childTaxCredit, r.calculation.determinedTax, r.calculation.balance], [0, 389_070, -1_250_930])
  assert.deepEqual(r.warnings, [RULE_NOTE_2026, DRAFT_1])
  // 저장 형식: D2-1 초기 데이터와 같은 항목·순서, 1건만 (교체)
  const stored = saved(storage).yearEndInputs
  assert.equal(stored.length, 1)
  assert.deepEqual(Object.keys(stored[0]), Object.keys(createSeedData().yearEndInputs[0]))
  assert.deepEqual({ ...stored[0], updatedAt: null }, { employeeId: 2, taxYear: 2026, ...changed, updatedAt: null })
  // 새로고침과 같음: 같은 저장소로 새 객체를 만들어도 유지
  const reloaded = createDemoStore({ storage })
  assert.equal(handleDemoRequest(reloaded, '/api/year-end/2026/employees/2/input').childCreditCount, 0)
  assert.equal(handleDemoRequest(reloaded, '/api/year-end/2026/employees/2/result').calculation.determinedTax, 389_070)
})

test('입력 저장: 값이 같으면 수정 시각 유지(서버 @PreUpdate 와 같음), 새 사원은 새로 만들고 목록에 저장 표시', () => {
  const { call, storage } = setup()
  assert.equal(call('/api/year-end/2026/employees/2/input', put(DEMO002_SEED)).updatedAt, '2026-09-01T09:00:00.000')
  // DEMO001: 새로 저장 (부녀자 공제 선택 — 근로소득금액 3천만원 이하라 적용)
  const created = call('/api/year-end/2026/employees/1/input', put({ ...SELF, womanDeduction: true }))
  assert.deepEqual([created.saved, created.womanDeduction], [true, true])
  assert.deepEqual(saved(storage).yearEndInputs.map((i) => [i.employeeId, i.taxYear]), [[2, 2026], [1, 2026]])
  assert.equal(call('/api/year-end/2026/employees').find((e) => e.employeeNo === 'DEMO001').inputSaved, true)
  const r = call('/api/year-end/2026/employees/1/result')
  assert.equal(r.calculation.additionalDeduction.woman, 500_000)
  assert.ok(!r.warnings.includes(NO_INPUT))
  // 다른 귀속연도는 따로 저장된다
  call('/api/year-end/2025/employees/1/input', put(SELF))
  assert.equal(saved(storage).yearEndInputs.length, 3)
})

test('입력 검증: 항목별 필수·범위(선언 순서, 항목마다 첫 오류) → 400 fieldErrors, 저장소는 바뀌지 않음', () => {
  const { call, storage } = setup()
  call('/api/employees') // 첫 저장
  const before = storage.data.get(STORAGE_KEY)
  expectError(() => call('/api/year-end/2026/employees/2/input', put({})), 400, {
    message: '입력값을 확인해 주세요.',
    fieldErrors: {
      spouseDeduction: '배우자 기본공제 여부를 선택해 주세요.', dependentCount: '부양가족 인원을 입력해 주세요.', elderlyCount: '경로우대 인원을 입력해 주세요.',
      disabledCount: '장애인 인원을 입력해 주세요.', womanDeduction: '부녀자 공제 여부를 선택해 주세요.', singleParentDeduction: '한부모 공제 여부를 선택해 주세요.',
      childCreditCount: '자녀세액공제 대상 자녀 수를 입력해 주세요.', birthFirstCount: '출산·입양 첫째 인원을 입력해 주세요.',
      birthSecondCount: '출산·입양 둘째 인원을 입력해 주세요.', birthThirdPlusCount: '출산·입양 셋째 이상 인원을 입력해 주세요.',
    },
  })
  expectError(() => call('/api/year-end/2026/employees/2/input', put({ ...SELF, dependentCount: 21, elderlyCount: -1, childCreditCount: 21, birthFirstCount: 2, birthThirdPlusCount: 11 })), 400, {
    fieldErrors: {
      dependentCount: '부양가족 인원은 0~20명으로 입력해 주세요.', elderlyCount: '경로우대 인원은 0명 이상으로 입력해 주세요.',
      childCreditCount: '자녀세액공제 대상 자녀 수는 부양가족 인원 이하로 입력해 주세요.', birthFirstCount: '출산·입양 첫째는 0~1명으로 입력해 주세요.',
      birthThirdPlusCount: '출산·입양 셋째 이상은 0~10명으로 입력해 주세요.',
    },
  })
  assert.equal(storage.data.get(STORAGE_KEY), before)
})

test('입력 검증: 여러 항목에 걸친 규칙 위반은 fieldErrors.input (서버 PersonalDeductionInput 과 같은 문구)', () => {
  const { call } = setup()
  const cases = [
    [{ ...SELF, spouseDeduction: true, singleParentDeduction: true }, '배우자 기본공제와 한부모 공제는 함께 선택할 수 없습니다.'],
    [{ ...SELF, dependentCount: 1, childCreditCount: 2 }, '자녀세액공제 대상 자녀 수는 부양가족 인원 이하로 입력해 주세요.'],
    [{ ...SELF, elderlyCount: 2 }, '경로우대 인원은 기본공제 대상자 수(1명) 이하로 입력해 주세요.'],
    [{ ...SELF, spouseDeduction: true, disabledCount: 3 }, '장애인 인원은 기본공제 대상자 수(2명) 이하로 입력해 주세요.'],
    [{ ...SELF, dependentCount: 1, birthFirstCount: 1, birthSecondCount: 1 }, '출산·입양 자녀 수의 합은 부양가족 인원 이하로 입력해 주세요.'],
  ]
  for (const [body, message] of cases) {
    expectError(() => call('/api/year-end/2026/employees/2/input', put(body)), 400, { message: '입력값을 확인해 주세요.', fieldErrors: { input: message } })
  }
  assert.equal(call('/api/year-end/2026/employees/2/input').childCreditCount, 1, '실패한 저장은 반영되지 않음')
})

test('입력 형식 오류: 본문이 객체가 아니거나 여부·인원 항목의 형식이 틀리면 400 (본문을 읽을 수 없음)', () => {
  const { call } = setup()
  const notReadable = { message: '요청 형식이 올바르지 않습니다. JSON 형식과 날짜(YYYY-MM-DD), 재직 상태 값을 확인해 주세요.', fieldErrors: {} }
  for (const body of [null, 'x', [], { ...SELF, spouseDeduction: 'true' }, { ...SELF, dependentCount: 1.5 }, { ...SELF, childCreditCount: '1' }]) {
    expectError(() => call('/api/year-end/2026/employees/2/input', put(body)), 400, notReadable)
  }
})

test('삭제된 사원: 조회·계산은 가능(editable=false, deleted=true), 입력 저장은 409', () => {
  const { call } = setup()
  call('/api/employees/7', { method: 'DELETE' })
  assert.equal(call('/api/year-end/2026/employees/7/input').editable, false)
  assert.equal(call('/api/year-end/2026/employees/7/result').employee.deleted, true)
  assert.equal(call('/api/year-end/2026/employees').find((e) => e.employeeNo === 'DEMO007').deleted, true)
  expectError(() => call('/api/year-end/2026/employees/7/input', put(SELF)), 409, { message: '삭제된 사원의 연말정산 자료는 저장할 수 없습니다.', fieldErrors: {} })
})

test('확정 급여가 없는 연도(2025): 목록은 빈 배열, 결과는 calculable=false (퇴사자는 퇴사 안내 추가)', () => {
  const { call } = setup()
  assert.deepEqual(call('/api/year-end/2025/employees'), [])
  const r = call('/api/year-end/2025/employees/1/result')
  assert.deepEqual([r.calculable, r.inputSaved, r.payrollCount, r.excludedDraftPayrollCount, r.sources, r.calculation], [false, false, 0, 0, null, null])
  assert.deepEqual(r.warnings, ['확정된 급여가 없어 계산할 수 없습니다.'])
  assert.deepEqual(r.assumptions, ASSUMPTIONS)
  assert.deepEqual(r.employee, { employeeId: 1, employeeNo: 'DEMO001', employeeName: '가상일', department: '인사팀', position: '대리', deleted: false, resigned: false })
  assert.deepEqual(call('/api/year-end/2025/employees/6/result').warnings, ['확정된 급여가 없어 계산할 수 없습니다.', RESIGNED])
})

test('식대 월 20만원 초과 달 경고 (10월 급여 식대 25만원 입력·확정 후)', () => {
  const { call } = setup()
  const period = call('/api/payroll-periods', { method: 'POST', body: { year: 2026, month: 10, paymentDate: '2026-10-23' } })
  call(`/api/payroll-periods/${period.id}/payrolls`, { method: 'POST', body: { employeeId: 4, lines: [{ payItemId: 1, amount: 3_200_000 }, { payItemId: 4, amount: 250_000 }] } })
  call(`/api/payroll-periods/${period.id}/confirm`, { method: 'POST' })
  const r = call('/api/year-end/2026/employees/4/result')
  assert.equal(r.payrollCount, 9)
  assert.deepEqual(r.warnings, [RULE_NOTE_2026, NO_INPUT, '식대가 월 20만원을 넘는 달이 있습니다(10월). 비과세 한도 초과분의 과세 전환은 반영하지 않았습니다.'])
})

test('오류: 연도 형식·범위, 사원 id 형식, 없는 사원 404, 서버와 같은 검사 순서, 지원하지 않는 방식 405, 없는 경로 404', () => {
  const { call } = setup()
  const yearRange = { fieldErrors: { year: '연도는 2000~2100 사이로 입력해 주세요.' } }
  expectError(() => call('/api/year-end/abc/employees'), 400, { message: '입력값을 확인해 주세요.', fieldErrors: { year: '형식이 올바르지 않습니다.' } })
  expectError(() => call('/api/year-end/1999/employees'), 400, yearRange)
  expectError(() => call('/api/year-end/2101/employees/1/result'), 400, yearRange)
  expectError(() => call('/api/year-end/2026/employees/x/input'), 400, { fieldErrors: { employeeId: '형식이 올바르지 않습니다.' } })
  const notFound = { message: '사원 정보를 찾을 수 없습니다.', fieldErrors: {} }
  expectError(() => call('/api/year-end/2026/employees/99/input'), 404, notFound)
  expectError(() => call('/api/year-end/2026/employees/99/result'), 404, notFound)
  expectError(() => call('/api/year-end/2026/employees/99/input', put(SELF)), 404, notFound)
  // 서버 순서: 본문 검사(@Valid) → 연도 → 사원
  assert.throws(() => call('/api/year-end/1999/employees/99/input', put({})), (e) => e.status === 400 && Object.keys(e.fieldErrors).length === 10 && !('year' in e.fieldErrors))
  expectError(() => call('/api/year-end/1999/employees/99/input', put(SELF)), 400, yearRange)
  expectError(() => call('/api/year-end/2026/employees', { method: 'POST' }), 405)
  expectError(() => call('/api/year-end/2026/employees/1/input', { method: 'DELETE' }), 405)
  expectError(() => call('/api/year-end/2026/employees/1/result', put(SELF)), 405)
  expectError(() => call('/api/year-end/2026'), 404)
  expectError(() => call('/api/year-end/2026/employees/1'), 404)
})

test('조회는 저장소를 바꾸지 않고, 초기화하면 DEMO002 초기 입력으로 돌아간다', () => {
  const { call, store, storage } = setup()
  call('/api/employees')
  const before = storage.data.get(STORAGE_KEY)
  call('/api/year-end/2026/employees')
  call('/api/year-end/2026/employees/2/input')
  call('/api/year-end/2026/employees/2/result')
  assert.equal(storage.data.get(STORAGE_KEY), before)
  call('/api/year-end/2026/employees/2/input', put(SELF))
  store.reset()
  assert.deepEqual(call('/api/year-end/2026/employees/2/input').childCreditCount, 1)
  assert.deepEqual(store.getState(), createSeedData())
})
