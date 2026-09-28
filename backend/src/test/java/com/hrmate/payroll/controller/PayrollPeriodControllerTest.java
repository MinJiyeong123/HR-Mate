package com.hrmate.payroll.controller;

import static org.hamcrest.Matchers.hasKey;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hrmate.employee.domain.EmploymentStatus;
import com.hrmate.global.error.BusinessException;
import com.hrmate.global.error.ErrorCode;
import com.hrmate.payroll.domain.PayrollPeriodStatus;
import com.hrmate.payroll.dto.EligibleEmployeeResponse;
import com.hrmate.payroll.dto.PayrollDetailResponse;
import com.hrmate.payroll.dto.PayrollPeriodDetailResponse;
import com.hrmate.payroll.dto.PayrollPeriodSummaryResponse;
import com.hrmate.payroll.service.PayrollPeriodService;
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
 * 급여 기간 API 계층 테스트 (가짜 서비스 사용, DB 접속 없음)
 * 안전장치: DB 주소를 접속할 수 없는 주소로 덮어쓴다.
 */
@WebMvcTest(PayrollPeriodController.class)
@TestPropertySource(properties = "spring.datasource.url=jdbc:mariadb://127.0.0.1:1/no_db_in_webmvc_test")
class PayrollPeriodControllerTest {

    private static final PayrollPeriodSummaryResponse SUMMARY = new PayrollPeriodSummaryResponse(
            3L, 2026, 4, LocalDate.of(2026, 4, 25), PayrollPeriodStatus.DRAFT, null, 1, 3_200_000, 235_000, 2_965_000);

    private static final PayrollDetailResponse PAYSLIP = new PayrollDetailResponse(
            10L, new PayrollDetailResponse.PeriodInfo(3L, 2026, 4, LocalDate.of(2026, 4, 25), PayrollPeriodStatus.DRAFT),
            2L, "E2019001", "김하늘", "인사팀", "과장", List.of(), List.of(), 3_200_000, 235_000, 2_965_000, null);

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PayrollPeriodService periodService;

    @MockitoBean
    private PayrollService payrollService;

    @Test
    void 기간_목록은_합계를_포함한다() throws Exception {
        when(periodService.getPeriods()).thenReturn(List.of(SUMMARY));

        mockMvc.perform(get("/api/payroll-periods"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].year").value(2026))
                .andExpect(jsonPath("$[0].month").value(4))
                .andExpect(jsonPath("$[0].paymentDate").value("2026-04-25"))
                .andExpect(jsonPath("$[0].status").value("DRAFT"))
                .andExpect(jsonPath("$[0].totalNetPay").value(2_965_000));
    }

    @Test
    void 기간_생성은_201과_Location_헤더를_돌려준다() throws Exception {
        when(periodService.createPeriod(any())).thenReturn(SUMMARY);

        mockMvc.perform(post("/api/payroll-periods").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"year\":2026,\"month\":4,\"paymentDate\":\"2026-04-25\"}"))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/payroll-periods/3"));
    }

    @Test
    void 기간_생성_입력값_오류는_항목별_400이다() throws Exception {
        mockMvc.perform(post("/api/payroll-periods").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"year\":1999,\"month\":13}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors.year").value("연도는 2000~2100 사이로 입력해 주세요."))
                .andExpect(jsonPath("$.fieldErrors.month").value("월은 1~12 사이로 입력해 주세요."))
                .andExpect(jsonPath("$.fieldErrors.paymentDate").value("지급일을 입력해 주세요."));
        verifyNoInteractions(periodService);
    }

    @Test
    void 같은_연월_기간은_409다() throws Exception {
        when(periodService.createPeriod(any())).thenThrow(new BusinessException(ErrorCode.PAYROLL_PERIOD_DUPLICATED));

        mockMvc.perform(post("/api/payroll-periods").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"year\":2026,\"month\":4,\"paymentDate\":\"2026-04-25\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PAYROLL_PERIOD_DUPLICATED"));
    }

    @Test
    void 기간_상세는_사원별_급여를_포함하고_없으면_404다() throws Exception {
        when(periodService.getPeriod(3L)).thenReturn(PayrollPeriodDetailResponse.of(SUMMARY, List.of()));
        when(periodService.getPeriod(9L)).thenThrow(new BusinessException(ErrorCode.PAYROLL_PERIOD_NOT_FOUND));

        mockMvc.perform(get("/api/payroll-periods/3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.payrolls").isArray());
        mockMvc.perform(get("/api/payroll-periods/9"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PAYROLL_PERIOD_NOT_FOUND"));
    }

    @Test
    void 확정된_기간의_지급일_수정은_409다() throws Exception {
        when(periodService.updatePaymentDate(eq(3L), any()))
                .thenThrow(new BusinessException(ErrorCode.PAYROLL_PERIOD_CONFIRMED));

        mockMvc.perform(put("/api/payroll-periods/3").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentDate\":\"2026-04-24\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PAYROLL_PERIOD_CONFIRMED"));
    }

    @Test
    void 확정과_확정_취소() throws Exception {
        when(periodService.confirm(3L)).thenReturn(SUMMARY);
        when(periodService.confirm(4L)).thenThrow(new BusinessException(ErrorCode.INVALID_PAYROLL_PERIOD_STATE,
                "급여 내역이 1건 이상 있어야 확정할 수 있습니다."));
        when(periodService.reopen(3L)).thenReturn(SUMMARY);

        mockMvc.perform(post("/api/payroll-periods/3/confirm")).andExpect(status().isOk());
        mockMvc.perform(post("/api/payroll-periods/4/confirm"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_PAYROLL_PERIOD_STATE"))
                .andExpect(jsonPath("$.message").value("급여 내역이 1건 이상 있어야 확정할 수 있습니다."));
        mockMvc.perform(post("/api/payroll-periods/3/reopen")).andExpect(status().isOk());
    }

    @Test
    void 입력_가능한_사원_목록() throws Exception {
        when(periodService.getEligibleEmployees(3L)).thenReturn(List.of(
                new EligibleEmployeeResponse(5L, "E2023001", "강도윤", "개발팀", "사원", EmploymentStatus.ACTIVE)));

        mockMvc.perform(get("/api/payroll-periods/3/eligible-employees"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].employeeNo").value("E2023001"));
    }

    @Test
    void 급여_입력은_201과_Location_헤더를_돌려준다() throws Exception {
        when(payrollService.createPayroll(eq(3L), any())).thenReturn(PAYSLIP);

        mockMvc.perform(post("/api/payroll-periods/3/payrolls").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"employeeId\":2,\"lines\":[{\"payItemId\":1,\"amount\":3000000}],\"memo\":null}"))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/payrolls/10"));
    }

    @Test
    void 급여_입력값_오류는_항목별_400이다() throws Exception {
        mockMvc.perform(post("/api/payroll-periods/3/payrolls").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lines\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.employeeId").value("사원을 선택해 주세요."))
                .andExpect(jsonPath("$.fieldErrors.lines").value("급여 항목을 입력해 주세요."));

        mockMvc.perform(post("/api/payroll-periods/3/payrolls").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"employeeId\":2,\"lines\":[{\"payItemId\":1,\"amount\":-1}]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors", hasKey("lines[0].amount")));
        verifyNoInteractions(payrollService);
    }

    @Test
    void 재직하지_않은_사원은_400_중복은_409다() throws Exception {
        when(payrollService.createPayroll(eq(3L), any()))
                .thenThrow(new BusinessException(ErrorCode.EMPLOYEE_NOT_ELIGIBLE))
                .thenThrow(new BusinessException(ErrorCode.PAYROLL_DUPLICATED));
        String body = "{\"employeeId\":2,\"lines\":[{\"payItemId\":1,\"amount\":1000}]}";

        mockMvc.perform(post("/api/payroll-periods/3/payrolls").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("EMPLOYEE_NOT_ELIGIBLE"));
        mockMvc.perform(post("/api/payroll-periods/3/payrolls").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PAYROLL_DUPLICATED"));
    }
}
