// ------------------------------------------------------------------
// 체험 모드 초기 가상 데이터 (실제 인물·연락처 아님)
// - 처음 방문하거나 초기화할 때 이 데이터로 시작한다.
// - createSeedData() 는 호출할 때마다 새 복사본을 돌려준다(원본이 바뀌지 않도록).
// - 급여 항목은 백엔드 V2 마이그레이션의 시드와 같은 코드·이름·순서·id 를 쓴다.
// ------------------------------------------------------------------

export const SCHEMA_VERSION = 1

// 백엔드 V2__create_payroll.sql 의 pay_item 시드와 같은 내용 (id 는 입력 순서)
// 함수 호출 없는 단순 배열로 둔다: 일반 모드 빌드에서 쓰이지 않으면 번들에서 빠진다. (읽는 쪽에서 복사해 쓴다)
export const PAY_ITEMS = [
  { id: 1, code: 'BASE_SALARY', name: '기본급', category: 'EARNING', taxType: 'TAXABLE', sortOrder: 10 },
  { id: 2, code: 'OVERTIME_PAY', name: '연장근로수당', category: 'EARNING', taxType: 'TAXABLE', sortOrder: 20 },
  { id: 3, code: 'BONUS', name: '상여금', category: 'EARNING', taxType: 'TAXABLE', sortOrder: 30 },
  { id: 4, code: 'MEAL_ALLOWANCE', name: '식대', category: 'EARNING', taxType: 'NON_TAXABLE', sortOrder: 40 },
  { id: 5, code: 'OTHER_ALLOWANCE', name: '기타수당', category: 'EARNING', taxType: 'TAXABLE', sortOrder: 50 },
  { id: 6, code: 'INCOME_TAX', name: '소득세', category: 'DEDUCTION', taxType: 'NONE', sortOrder: 110 },
  { id: 7, code: 'LOCAL_INCOME_TAX', name: '지방소득세', category: 'DEDUCTION', taxType: 'NONE', sortOrder: 120 },
  { id: 8, code: 'NATIONAL_PENSION', name: '국민연금', category: 'DEDUCTION', taxType: 'NONE', sortOrder: 130 },
  { id: 9, code: 'HEALTH_INSURANCE', name: '건강보험', category: 'DEDUCTION', taxType: 'NONE', sortOrder: 140 },
  { id: 10, code: 'LONG_TERM_CARE', name: '장기요양보험', category: 'DEDUCTION', taxType: 'NONE', sortOrder: 150 },
  { id: 11, code: 'EMPLOYMENT_INSURANCE', name: '고용보험', category: 'DEDUCTION', taxType: 'NONE', sortOrder: 160 },
  { id: 12, code: 'OTHER_DEDUCTION', name: '기타공제', category: 'DEDUCTION', taxType: 'NONE', sortOrder: 170 },
]

function employee(id, name, department, position, hireDate, resignationDate = null) {
  return {
    id,
    employeeNo: `DEMO${String(id).padStart(3, '0')}`,
    name,
    department,
    position,
    phone: null,
    email: null,
    hireDate,
    employmentStatus: resignationDate ? 'RESIGNED' : 'ACTIVE',
    resignationDate,
    deletedAt: null,
  }
}

// 급여는 입력 당시 사원 정보를 복사해 둔다(백엔드와 같은 방식). 합계는 저장하지 않고 항목으로 계산한다.
function payroll(id, periodId, emp, lines) {
  return {
    id,
    periodId,
    employeeId: emp.id,
    employeeNo: emp.employeeNo,
    employeeName: emp.name,
    department: emp.department,
    position: emp.position,
    lines,
    memo: null,
  }
}

const line = (payItemId, amount) => ({ payItemId, amount })

// 2026년 1~8월 확정 급여를 만들 때 쓰는 사원별 월 금액 (모두 직접 정한 시뮬레이션 값, 법정 계산 아님)
// [사원 id, 기본급, 소득세, 국민연금, 건강보험, 장기요양보험, 고용보험, 7월 상여금에 더하는 소득세]
// 식대는 모두 월 20만원(비과세), 지방소득세는 소득세의 10%, 7월에는 기본급의 50% 를 상여금으로 준다.
const MONTHLY_PAY = [
  [1, 3_000_000, 100_000, 135_000, 100_000, 5_000, 20_000, 120_000],
  [2, 3_600_000, 180_000, 162_000, 75_000, 5_000, 20_000, 200_000],
  [3, 2_700_000, 70_000, 121_500, 95_700, 4_800, 20_000, 80_000],
  [4, 3_200_000, 60_000, 144_000, 113_400, 14_680, 28_800, 90_000],
  [5, 2_600_000, 20_000, 117_000, 92_100, 11_920, 23_400, 40_000],
  [6, 4_000_000, 250_000, 180_000, 141_800, 18_360, 36_000, 0], // 2026-06-30 퇴사 → 1~6월만
  [7, 2_800_000, 40_000, 126_000, 99_260, 12_850, 25_200, 50_000],
  [8, 2_500_000, 20_000, 112_500, 88_620, 11_470, 22_500, 30_000],
]
const CONFIRMED_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8]
const BONUS_MONTH = 7

const pad2 = (n) => String(n).padStart(2, '0')

/** 확정된 2026년 1~8월 급여 기간 (id 2~9). 지급일은 매월 25일, 확정 시각은 그 전날 오후 */
function confirmedPeriods() {
  return CONFIRMED_MONTHS.map((month, index) => ({
    id: index + 2,
    year: 2026,
    month,
    paymentDate: `2026-${pad2(month)}-25`,
    status: 'CONFIRMED',
    confirmedAt: `2026-${pad2(month)}-24T17:00:00.000`,
  }))
}

/** 확정 기간의 급여: 기간(월) 순, 같은 달은 사번 순으로 id 4 부터. 그 달 퇴사일 이후 사원은 제외 */
function confirmedPayrolls(employees, periods) {
  const payrolls = []
  let id = 4
  for (const period of periods) {
    const lastDay = `2026-${pad2(period.month)}-31`
    for (const [employeeId, base, incomeTax, pension, health, longTermCare, employment, bonusTax] of MONTHLY_PAY) {
      const emp = employees.find((e) => e.id === employeeId)
      if (emp.resignationDate !== null && emp.resignationDate < `2026-${pad2(period.month)}-01`) continue
      if (emp.hireDate > lastDay) continue
      const bonusMonth = period.month === BONUS_MONTH
      const tax = incomeTax + (bonusMonth ? bonusTax : 0)
      payrolls.push(payroll(id++, period.id, emp, [
        line(1, base),
        ...(bonusMonth ? [line(3, base / 2)] : []),
        line(4, 200_000),
        line(6, tax),
        line(7, tax / 10),
        line(8, pension),
        line(9, health),
        line(10, longTermCare),
        line(11, employment),
      ]))
    }
  }
  return payrolls
}

export function createSeedData() {
  const employees = [
    employee(1, '가상일', '인사팀', '대리', '2021-03-02'),
    employee(2, '가상이', '재무팀', '과장', '2019-07-01'),
    employee(3, '가상삼', '개발팀', '사원', '2024-01-02'),
    employee(4, '가상사', '개발팀', '대리', '2022-09-01'),
    employee(5, '가상오', '영업팀', '사원', '2025-02-03'),
    employee(6, '가상육', '영업팀', '과장', '2018-05-14', '2026-06-30'),
    employee(7, '가상칠', '마케팅팀', '사원', '2023-04-03'),
    employee(8, '가상팔', '인사팀', '사원', '2025-08-01'),
  ]
  // 2026년 9월(id 1, 작성 중)은 D1 부터 있던 기간이다. 연간 집계·연말정산에는 확정된 1~8월(id 2~9)만 합산된다.
  const periods = confirmedPeriods()
  const payrollPeriods = [
    { id: 1, year: 2026, month: 9, paymentDate: '2026-09-25', status: 'DRAFT', confirmedAt: null },
    ...periods,
  ]
  const payrolls = [
    payroll(1, 1, employees[0], [line(1, 3_000_000), line(4, 200_000), line(6, 100_000), line(7, 10_000), line(8, 135_000), line(9, 100_000), line(10, 5_000), line(11, 20_000)]),
    payroll(2, 1, employees[1], [line(1, 3_600_000), line(4, 200_000), line(6, 180_000), line(7, 18_000), line(8, 162_000), line(9, 75_000), line(10, 5_000), line(11, 20_000)]),
    payroll(3, 1, employees[2], [line(1, 2_700_000), line(4, 200_000), line(6, 70_000), line(7, 7_000), line(8, 121_500), line(9, 95_700), line(10, 4_800), line(11, 20_000)]),
    ...confirmedPayrolls(employees, periods),
  ]
  // 연말정산 입력 자료 예시 1건 (가상): DEMO002 2026년 귀속 — 배우자 기본공제, 부양가족 1명(자녀세액공제 대상 1명).
  // 나머지 사원은 입력 자료가 없어 "본인 기본공제만" 으로 계산된다.
  const yearEndInputs = [
    {
      employeeId: 2,
      taxYear: 2026,
      spouseDeduction: true,
      dependentCount: 1,
      elderlyCount: 0,
      disabledCount: 0,
      womanDeduction: false,
      singleParentDeduction: false,
      childCreditCount: 1,
      birthFirstCount: 0,
      birthSecondCount: 0,
      birthThirdPlusCount: 0,
      updatedAt: '2026-09-01T09:00:00.000',
    },
  ]
  return {
    schemaVersion: SCHEMA_VERSION,
    nextIds: { employee: 9, payrollPeriod: 10, payroll: payrolls.length + 1 },
    employees,
    payrollPeriods,
    payrolls,
    yearEndInputs,
  }
}
