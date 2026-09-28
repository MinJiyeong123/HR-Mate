package com.hrmate.payroll.dto;

import com.hrmate.employee.domain.Employee;
import com.hrmate.payroll.domain.PayItem;
import com.hrmate.payroll.domain.PayItemCategory;
import com.hrmate.payroll.domain.Payroll;
import com.hrmate.payroll.domain.PayrollLine;
import com.hrmate.payroll.domain.TaxType;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 사원별 연간 급여 상세 (GET /api/payroll-summaries/annual/employees/{id}?year=) - 포트폴리오용 시뮬레이션
 *
 * <ul>
 *   <li>귀속 연도(pay_year) 기준, 확정된 기간의 급여만 합산한다. 월별 행에 지급일을 함께 보여준다.</li>
 *   <li>사원 정보는 그 해 마지막 확정 급여의 스냅샷이고, 확정 급여가 없으면 현재 사원 정보다.</li>
 *   <li>항목별 합계는 항목 표시 순서로 정렬한다. 비과세 한도는 검사하지 않는다.</li>
 * </ul>
 */
public record AnnualEmployeePayrollResponse(
        int year,
        Long employeeId,
        String employeeNo,
        String employeeName,
        String department,
        String position,
        boolean deleted,
        long excludedDraftPayrollCount,
        AnnualTotals totals,
        List<MonthlyPayroll> months,
        List<ItemTotal> items
) {

    /** 월별 한 줄 */
    public record MonthlyPayroll(
            Long payrollId,
            int month,
            LocalDate paymentDate,
            long totalEarnings,
            long taxableEarnings,
            long nonTaxableEarnings,
            long totalDeductions,
            long netPay
    ) {

        static MonthlyPayroll from(Payroll payroll) {
            AnnualTotals totals = AnnualTotals.from(payroll);
            return new MonthlyPayroll(payroll.getId(), payroll.getPeriod().getPayMonth(),
                    payroll.getPeriod().getPaymentDate(), totals.totalEarnings(), totals.taxableEarnings(),
                    totals.nonTaxableEarnings(), totals.totalDeductions(), totals.netPay());
        }
    }

    /** 항목별 연간 합계 (항목 이름·분류·과세 구분은 입력 당시 복사해 둔 값) */
    public record ItemTotal(Long payItemId, String itemName, PayItemCategory category, TaxType taxType, long amount) {
    }

    /** payrolls: 이 사원의 확정 급여, 월 순 (0건 가능) */
    public static AnnualEmployeePayrollResponse of(int year, Employee employee, List<Payroll> payrolls,
                                                   long excludedDraftPayrollCount) {
        List<AnnualTotals> monthlyTotals = payrolls.stream().map(AnnualTotals::from).toList();
        List<MonthlyPayroll> months = payrolls.stream().map(MonthlyPayroll::from).toList();

        if (payrolls.isEmpty()) {
            return new AnnualEmployeePayrollResponse(year, employee.getId(), employee.getEmployeeNo(),
                    employee.getName(), employee.getDepartment(), employee.getPosition(), employee.isDeleted(),
                    excludedDraftPayrollCount, AnnualTotals.ZERO, months, List.of());
        }
        Payroll latest = payrolls.get(payrolls.size() - 1);
        return new AnnualEmployeePayrollResponse(year, employee.getId(), latest.getEmployeeNo(),
                latest.getEmployeeName(), latest.getDepartment(), latest.getPosition(), employee.isDeleted(),
                excludedDraftPayrollCount, AnnualTotals.sum(monthlyTotals), months, itemTotals(payrolls));
    }

    private static List<ItemTotal> itemTotals(List<Payroll> payrolls) {
        Map<Long, PayItem> itemsById = new LinkedHashMap<>();
        Map<Long, ItemTotal> totalsById = new LinkedHashMap<>();
        for (Payroll payroll : payrolls) {
            for (PayrollLine line : payroll.getLines()) {
                PayItem item = line.getPayItem();
                itemsById.putIfAbsent(item.getId(), item);
                totalsById.merge(item.getId(),
                        new ItemTotal(item.getId(), line.getItemName(), line.getCategory(), line.getTaxType(),
                                line.getAmount()),
                        (sum, added) -> new ItemTotal(sum.payItemId(), sum.itemName(), sum.category(), sum.taxType(),
                                sum.amount() + added.amount()));
            }
        }
        return totalsById.values().stream()
                .sorted(Comparator.comparingInt((ItemTotal total) -> itemsById.get(total.payItemId()).getSortOrder()))
                .toList();
    }
}
