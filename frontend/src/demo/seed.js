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
  const payrollPeriods = [
    { id: 1, year: 2026, month: 9, paymentDate: '2026-09-25', status: 'DRAFT', confirmedAt: null },
  ]
  const payrolls = [
    payroll(1, 1, employees[0], [line(1, 3_000_000), line(4, 200_000), line(6, 100_000), line(7, 10_000), line(8, 135_000), line(9, 100_000), line(10, 5_000), line(11, 20_000)]),
    payroll(2, 1, employees[1], [line(1, 3_600_000), line(4, 200_000), line(6, 180_000), line(7, 18_000), line(8, 162_000), line(9, 75_000), line(10, 5_000), line(11, 20_000)]),
    payroll(3, 1, employees[2], [line(1, 2_700_000), line(4, 200_000), line(6, 70_000), line(7, 7_000), line(8, 121_500), line(9, 95_700), line(10, 4_800), line(11, 20_000)]),
  ]
  return {
    schemaVersion: SCHEMA_VERSION,
    nextIds: { employee: 9, payrollPeriod: 2, payroll: 4 },
    employees,
    payrollPeriods,
    payrolls,
    yearEndInputs: [],
  }
}
