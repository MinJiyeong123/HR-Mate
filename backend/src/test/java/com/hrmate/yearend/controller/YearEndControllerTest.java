package com.hrmate.yearend.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hrmate.global.error.BusinessException;
import com.hrmate.global.error.ErrorCode;
import com.hrmate.yearend.dto.YearEndEmployeeSummaryResponse;
import com.hrmate.yearend.dto.YearEndInputResponse;
import com.hrmate.yearend.dto.YearEndResultResponse;
import com.hrmate.yearend.service.YearEndService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 연말정산 API 계층 테스트 (가짜 서비스 사용, DB 접속 없음)
 * 안전장치: DB 주소를 접속할 수 없는 주소로 덮어쓴다.
 */
@WebMvcTest(YearEndController.class)
@TestPropertySource(properties = "spring.datasource.url=jdbc:mariadb://127.0.0.1:1/no_db_in_webmvc_test")
class YearEndControllerTest {

    private static final String VALID_BODY = """
            {"spouseDeduction":true,"dependentCount":1,"elderlyCount":0,"disabledCount":0,
             "womanDeduction":false,"singleParentDeduction":false,"childCreditCount":1,
             "birthFirstCount":0,"birthSecondCount":0,"birthThirdPlusCount":0}
            """;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private YearEndService yearEndService;

    @Test
    void 목록() throws Exception {
        when(yearEndService.getEmployees(2025)).thenReturn(List.of(new YearEndEmployeeSummaryResponse(
                7L, "E001", "김가상", "인사팀", "대리", false, false, true, 12, 36_000_000, 433_500, 1_000_000, -566_500, 2025)));

        mockMvc.perform(get("/api/year-end/2025/employees"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].employeeNo").value("E001"))
                .andExpect(jsonPath("$[0].inputSaved").value(true))
                .andExpect(jsonPath("$[0].balance").value(-566_500))
                .andExpect(jsonPath("$[0].rulesYear").value(2025));
    }

    @Test
    void 입력_저장_성공과_항목별_검증_오류() throws Exception {
        when(yearEndService.saveInput(eq(7L), eq(2025), any())).thenReturn(new YearEndInputResponse(
                2025, 7L, true, true, true, 1, 0, 0, false, false, 1, 0, 0, 0, null,
                8, "2025년 귀속: 소득세법(2026. 4. 21. 개정 전 문구)·국세청 2025년 귀속 안내 기준 · 전문가 검증 전", null));

        mockMvc.perform(put("/api/year-end/2025/employees/7/input").contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.saved").value(true))
                .andExpect(jsonPath("$.childCreditCount").value(1))
                .andExpect(jsonPath("$.childCreditMinimumAge").value(8))
                .andExpect(jsonPath("$.childCreditAgeCaution").doesNotExist());

        String invalid = VALID_BODY.replace("\"dependentCount\":1", "\"dependentCount\":21")
                .replace("\"birthFirstCount\":0", "\"birthFirstCount\":2");
        mockMvc.perform(put("/api/year-end/2025/employees/7/input").contentType(MediaType.APPLICATION_JSON).content(invalid))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.dependentCount").value("부양가족 인원은 0~20명으로 입력해 주세요."))
                .andExpect(jsonPath("$.fieldErrors.birthFirstCount").exists());
        mockMvc.perform(put("/api/year-end/2025/employees/7/input").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.spouseDeduction").exists());
        verify(yearEndService).saveInput(eq(7L), eq(2025), any()); // 검증 실패 요청은 서비스까지 오지 않음(성공 1회만)
    }

    @Test
    void 삭제된_사원의_입력_저장은_409() throws Exception {
        when(yearEndService.saveInput(eq(8L), eq(2025), any()))
                .thenThrow(new BusinessException(ErrorCode.YEAR_END_INPUT_LOCKED));

        mockMvc.perform(put("/api/year-end/2025/employees/8/input").contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("YEAR_END_INPUT_LOCKED"));
    }

    @Test
    void 계산_결과와_연도_형식_오류() throws Exception {
        when(yearEndService.getResult(7L, 2025)).thenReturn(new YearEndResultResponse(2025, YearEndService.NOTICE,
                new YearEndResultResponse.EmployeeInfo(7L, "E001", "김가상", "인사팀", "대리", false, false),
                false, false, 0, 0, null, null, List.of("확정된 급여가 없어 계산할 수 없습니다."), List.of()));

        mockMvc.perform(get("/api/year-end/2025/employees/7/result"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.calculable").value(false))
                .andExpect(jsonPath("$.notice").value("모의 계산 · 전문가 검증 전 · 지방소득세 미포함"))
                .andExpect(jsonPath("$.warnings[0]").value("확정된 급여가 없어 계산할 수 없습니다."));
        mockMvc.perform(get("/api/year-end/abc/employees/7/result"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.year").exists());
    }
}
