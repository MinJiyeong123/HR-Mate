package com.hrmate.payroll.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hrmate.global.error.BusinessException;
import com.hrmate.global.error.ErrorCode;
import com.hrmate.payroll.domain.PayItemCategory;
import com.hrmate.payroll.domain.PayrollPeriodStatus;
import com.hrmate.payroll.domain.TaxType;
import com.hrmate.payroll.dto.EmployeePayrollResponse;
import com.hrmate.payroll.dto.PayItemResponse;
import com.hrmate.payroll.dto.PayrollDetailResponse;
import com.hrmate.payroll.dto.PayrollLineResponse;
import com.hrmate.payroll.dto.PayrollUpdateRequest;
import com.hrmate.payroll.service.PayrollService;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 급여명세서·항목·사원별 내역 API 계층 테스트 (가짜 서비스 사용, DB 접속 없음)
 * 안전장치: DB 주소를 접속할 수 없는 주소로 덮어쓴다.
 */
@WebMvcTest({PayrollController.class, PayItemController.class})
@TestPropertySource(properties = "spring.datasource.url=jdbc:mariadb://127.0.0.1:1/no_db_in_webmvc_test")
class PayrollControllerTest {

    private static final PayrollDetailResponse PAYSLIP = new PayrollDetailResponse(
            10L, new PayrollDetailResponse.PeriodInfo(3L, 2026, 4, LocalDate.of(2026, 4, 25), PayrollPeriodStatus.DRAFT),
            2L, "E2019001", "김하늘", "인사팀", "과장",
            List.of(new PayrollLineResponse(1L, "기본급", TaxType.TAXABLE, 3_000_000),
                    new PayrollLineResponse(4L, "식대", TaxType.NON_TAXABLE, 200_000)),
            List.of(new PayrollLineResponse(6L, "소득세", TaxType.NONE, 100_000)),
            3_200_000, 100_000, 3_100_000, "4월 급여");

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PayrollService payrollService;

    @Test
    void 항목_목록() throws Exception {
        when(payrollService.getPayItems()).thenReturn(List.of(
                new PayItemResponse(1L, "BASE_SALARY", "기본급", PayItemCategory.EARNING, TaxType.TAXABLE, 10)));

        mockMvc.perform(get("/api/pay-items"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].code").value("BASE_SALARY"))
                .andExpect(jsonPath("$[0].category").value("EARNING"))
                .andExpect(jsonPath("$[0].taxType").value("TAXABLE"));
    }

    @Test
    void 명세서는_지급과_공제를_나눠_돌려주고_없으면_404다() throws Exception {
        when(payrollService.getPayroll(10L)).thenReturn(PAYSLIP);
        when(payrollService.getPayroll(99L)).thenThrow(new BusinessException(ErrorCode.PAYROLL_NOT_FOUND));

        mockMvc.perform(get("/api/payrolls/10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.period.year").value(2026))
                .andExpect(jsonPath("$.earnings[1].itemName").value("식대"))
                .andExpect(jsonPath("$.earnings[1].taxType").value("NON_TAXABLE"))
                .andExpect(jsonPath("$.deductions[0].amount").value(100_000))
                .andExpect(jsonPath("$.netPay").value(3_100_000));
        mockMvc.perform(get("/api/payrolls/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PAYROLL_NOT_FOUND"));
    }

    @Test
    void 수정_요청의_employeeId는_무시하고_확정된_기간은_409다() throws Exception {
        when(payrollService.updatePayroll(eq(10L), any())).thenReturn(PAYSLIP);
        when(payrollService.updatePayroll(eq(11L), any()))
                .thenThrow(new BusinessException(ErrorCode.PAYROLL_PERIOD_CONFIRMED));
        String body = "{\"employeeId\":999,\"lines\":[{\"payItemId\":1,\"amount\":3100000}],\"memo\":null}";

        mockMvc.perform(put("/api/payrolls/10").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
        verify(payrollService).updatePayroll(eq(10L), any(PayrollUpdateRequest.class));

        mockMvc.perform(put("/api/payrolls/11").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PAYROLL_PERIOD_CONFIRMED"));
    }

    @Test
    void 삭제는_204_확정된_기간은_409다() throws Exception {
        doThrow(new BusinessException(ErrorCode.PAYROLL_PERIOD_CONFIRMED)).when(payrollService).deletePayroll(11L);

        mockMvc.perform(delete("/api/payrolls/10")).andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/payrolls/11"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PAYROLL_PERIOD_CONFIRMED"));
    }

    @Test
    void 사원별_연간_내역은_연도가_필요하고_삭제된_사원은_404다() throws Exception {
        when(payrollService.getEmployeePayrolls(2L, 2026)).thenReturn(List.of(new EmployeePayrollResponse(
                10L, 3L, 2026, 4, LocalDate.of(2026, 4, 25), PayrollPeriodStatus.DRAFT, 3_200_000, 100_000, 3_100_000)));
        when(payrollService.getEmployeePayrolls(8L, 2026)).thenThrow(new BusinessException(ErrorCode.EMPLOYEE_NOT_FOUND));

        mockMvc.perform(get("/api/employees/2/payrolls").param("year", "2026"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].month").value(4));
        mockMvc.perform(get("/api/employees/2/payrolls"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.year").exists());
        mockMvc.perform(get("/api/employees/8/payrolls").param("year", "2026"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EMPLOYEE_NOT_FOUND"));
    }
}
