package com.hrmate.payroll.controller;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hrmate.global.error.BusinessException;
import com.hrmate.global.error.ErrorCode;
import com.hrmate.payroll.domain.PayItemCategory;
import com.hrmate.payroll.domain.TaxType;
import com.hrmate.payroll.dto.AnnualEmployeePayrollResponse;
import com.hrmate.payroll.dto.AnnualEmployeeSummaryResponse;
import com.hrmate.payroll.dto.AnnualPayrollSummaryResponse;
import com.hrmate.payroll.dto.AnnualTotals;
import com.hrmate.payroll.service.PayrollSummaryService;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 연간 급여 집계 API 계층 테스트 (가짜 서비스 사용, DB 접속 없음)
 * 안전장치: DB 주소를 접속할 수 없는 주소로 덮어쓴다.
 */
@WebMvcTest(PayrollSummaryController.class)
@TestPropertySource(properties = "spring.datasource.url=jdbc:mariadb://127.0.0.1:1/no_db_in_webmvc_test")
class PayrollSummaryControllerTest {

    private static final AnnualTotals TOTALS = new AnnualTotals(6_400_000, 6_000_000, 400_000, 200_000, 6_200_000);

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PayrollSummaryService summaryService;

    @Test
    void 연간_집계는_합계와_사원_목록을_돌려준다() throws Exception {
        when(summaryService.getAnnualSummary(2026)).thenReturn(new AnnualPayrollSummaryResponse(2026, 2, 1, TOTALS,
                List.of(new AnnualEmployeeSummaryResponse(7L, "E001", "김가상", "인사팀", "대리", true, 2, TOTALS))));

        mockMvc.perform(get("/api/payroll-summaries/annual").param("year", "2026"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.year").value(2026))
                .andExpect(jsonPath("$.excludedDraftPeriodCount").value(1))
                .andExpect(jsonPath("$.totals.taxableEarnings").value(6_000_000))
                .andExpect(jsonPath("$.totals.nonTaxableEarnings").value(400_000))
                .andExpect(jsonPath("$.employees[0].deleted").value(true))
                .andExpect(jsonPath("$.employees[0].totals.netPay").value(6_200_000));
    }

    @Test
    void 연도가_없거나_형식이_틀리면_400이다() throws Exception {
        mockMvc.perform(get("/api/payroll-summaries/annual"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.year").exists());
        mockMvc.perform(get("/api/payroll-summaries/annual").param("year", "abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.year").exists());
        mockMvc.perform(get("/api/payroll-summaries/annual/employees/7"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.year").exists());
    }

    @Test
    void 사원별_상세는_월별_지급일과_항목_합계를_돌려주고_없는_사원은_404다() throws Exception {
        when(summaryService.getEmployeeAnnual(7L, 2026)).thenReturn(new AnnualEmployeePayrollResponse(
                2026, 7L, "E001", "김가상", "인사팀", "대리", false, 1, TOTALS,
                List.of(new AnnualEmployeePayrollResponse.MonthlyPayroll(
                        100L, 12, LocalDate.of(2027, 1, 10), 3_200_000, 3_000_000, 200_000, 100_000, 3_100_000)),
                List.of(new AnnualEmployeePayrollResponse.ItemTotal(4L, "식대", PayItemCategory.EARNING,
                        TaxType.NON_TAXABLE, 400_000))));
        when(summaryService.getEmployeeAnnual(99L, 2026)).thenThrow(new BusinessException(ErrorCode.EMPLOYEE_NOT_FOUND));

        mockMvc.perform(get("/api/payroll-summaries/annual/employees/7").param("year", "2026"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.excludedDraftPayrollCount").value(1))
                .andExpect(jsonPath("$.months[0].month").value(12))
                .andExpect(jsonPath("$.months[0].paymentDate").value("2027-01-10"))
                .andExpect(jsonPath("$.items[0].taxType").value("NON_TAXABLE"))
                .andExpect(jsonPath("$.items[0].amount").value(400_000));
        mockMvc.perform(get("/api/payroll-summaries/annual/employees/99").param("year", "2026"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EMPLOYEE_NOT_FOUND"));
    }
}
