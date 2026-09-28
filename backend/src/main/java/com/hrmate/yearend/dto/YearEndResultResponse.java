package com.hrmate.yearend.dto;

import com.hrmate.yearend.calculator.YearEndCalculationResult;
import com.hrmate.yearend.calculator.YearEndCalculationResult.AdditionalDeduction;
import com.hrmate.yearend.calculator.YearEndCalculationResult.AppliedAmount;
import com.hrmate.yearend.domain.YearEndPayrollTotals;
import java.util.List;

/**
 * 연말정산 모의 계산 결과 (GET /api/year-end/{year}/employees/{id}/result) - 공식 결과가 아니다.
 *
 * <ul>
 *   <li>calculable=false 이면 확정 급여가 없어 calculation 은 null 이다.</li>
 *   <li>사원 정보는 그 해 마지막 확정 급여의 스냅샷(없으면 현재 사원 정보)이다.</li>
 *   <li>warnings: 계산 안내 + 급여 데이터 안내(식대 한도·작성 중 급여·퇴사자). assumptions: 가정한 계산 방식.</li>
 * </ul>
 */
public record YearEndResultResponse(
        int year,
        String notice,
        EmployeeInfo employee,
        boolean calculable,
        boolean inputSaved,
        int payrollCount,
        long excludedDraftPayrollCount,
        Sources sources,
        Calculation calculation,
        List<String> warnings,
        List<String> assumptions
) {

    public record EmployeeInfo(Long employeeId, String employeeNo, String employeeName, String department,
                               String position, boolean deleted, boolean resigned) {
    }

    /** 확정 급여의 연간 합계 (계산에 쓴 원자료) */
    public record Sources(long totalSalary, long nonTaxableEarnings, long healthInsurance, long longTermCare,
                          long employmentInsurance, long nationalPension, long incomeTax) {

        public static Sources from(YearEndPayrollTotals totals) {
            return new Sources(totals.totalSalary(), totals.nonTaxableEarnings(), totals.healthInsurance(),
                    totals.longTermCare(), totals.employmentInsurance(), totals.nationalPension(), totals.incomeTax());
        }
    }

    /** 단계별 금액 (AppliedAmount: requested 신청액, applied 적용액) */
    public record Calculation(
            int rulesYear,
            long totalSalary,
            long earnedIncomeDeduction,
            long earnedIncomeAmount,
            long basicDeduction,
            AdditionalDeduction additionalDeduction,
            AppliedAmount personalDeduction,
            AppliedAmount insuranceDeduction,
            AppliedAmount pensionDeduction,
            long taxBase,
            long calculatedTax,
            long earnedIncomeTaxCredit,
            long childTaxCredit,
            long birthAdoptionTaxCredit,
            long standardTaxCredit,
            AppliedAmount taxCredit,
            long determinedTax,
            long prepaidTax,
            long balance,
            long additionalPayment,
            long refund
    ) {

        public static Calculation from(YearEndCalculationResult r) {
            return new Calculation(r.rulesYear(), r.totalSalary(), r.earnedIncomeDeduction(), r.earnedIncomeAmount(),
                    r.basicDeduction(), r.additionalDeduction(), r.personalDeduction(), r.insuranceDeduction(),
                    r.pensionDeduction(), r.taxBase(), r.calculatedTax(), r.earnedIncomeTaxCredit(), r.childTaxCredit(),
                    r.birthAdoptionTaxCredit(), r.standardTaxCredit(), r.taxCredit(), r.determinedTax(), r.prepaidTax(),
                    r.balance(), r.additionalPayment(), r.refund());
        }
    }
}
