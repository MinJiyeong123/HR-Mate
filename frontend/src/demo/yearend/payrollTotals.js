// ------------------------------------------------------------------
// 한 사원의 확정 급여에서 연말정산에 쓰는 연간 합계 — 순수 함수 (저장소를 읽지 않는다)
// 원본: 백엔드 yearend/domain/YearEndPayrollTotals.java (docs/requirements-year-end.md 3장)
// 항목 구분은 항목의 분류·과세 구분과 항목 코드로 한다. 지방소득세·기타공제는 계산에 쓰지 않는다.
// ------------------------------------------------------------------

/** 비과세 식대 월 한도 (소득세법 제12조 제3호 러목, 경고에만 사용) */
export const MEAL_MONTHLY_LIMIT = 200_000

/**
 * @param payrolls 한 사원의 확정 급여, 월 순: [{ month, lines: [{ payItemId, amount }] }]
 * @param itemById 항목 id → { code, category, taxType } (체험 모드에서는 seed.js 의 PAY_ITEMS)
 * @returns { payrollCount, totalSalary, nonTaxableEarnings, healthInsurance, longTermCare, employmentInsurance,
 *            nationalPension, incomeTax, mealOverLimitMonths, insurancePremium }
 */
export function yearEndPayrollTotals(payrolls, itemById) {
  let taxable = 0
  let nonTaxable = 0
  let health = 0
  let longTermCare = 0
  let employment = 0
  let pension = 0
  let incomeTax = 0
  const mealOver = []

  for (const payroll of payrolls) {
    let meal = 0
    for (const line of payroll.lines) {
      const item = itemById(line.payItemId)
      const amount = line.amount
      if (item.category === 'EARNING') {
        if (item.taxType === 'TAXABLE') taxable += amount
        else nonTaxable += amount
        if (item.code === 'MEAL_ALLOWANCE') meal += amount
        continue
      }
      switch (item.code) {
        case 'HEALTH_INSURANCE': health += amount; break
        case 'LONG_TERM_CARE': longTermCare += amount; break
        case 'EMPLOYMENT_INSURANCE': employment += amount; break
        case 'NATIONAL_PENSION': pension += amount; break
        case 'INCOME_TAX': incomeTax += amount; break
        default: break // 지방소득세·기타공제는 연말정산 계산에 쓰지 않는다.
      }
    }
    if (meal > MEAL_MONTHLY_LIMIT) mealOver.push(payroll.month)
  }
  return {
    payrollCount: payrolls.length,
    totalSalary: taxable,
    nonTaxableEarnings: nonTaxable,
    healthInsurance: health,
    longTermCare,
    employmentInsurance: employment,
    nationalPension: pension,
    incomeTax,
    mealOverLimitMonths: mealOver,
    /** 보험료 특별소득공제 대상 (건강보험 + 장기요양보험 + 고용보험) */
    insurancePremium: health + longTermCare + employment,
  }
}
