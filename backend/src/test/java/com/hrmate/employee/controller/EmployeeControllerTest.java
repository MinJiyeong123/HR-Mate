package com.hrmate.employee.controller;

import static org.hamcrest.Matchers.aMapWithSize;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hrmate.employee.domain.EmploymentStatus;
import com.hrmate.employee.dto.EmployeeNoCheckResponse;
import com.hrmate.employee.dto.EmployeeResponse;
import com.hrmate.employee.dto.EmployeeUpdateRequest;
import com.hrmate.employee.service.EmployeeService;
import com.hrmate.global.error.BusinessException;
import com.hrmate.global.error.ErrorCode;
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
 * 사원 API 계층 테스트 (가짜 서비스 사용, DB 접속 없음)
 *
 * 안전장치: DB 주소를 접속할 수 없는 주소로 덮어써서, 실수로 DB 연결을 시도하면
 * hr_mate 에 닿지 않고 테스트가 실패하도록 한다.
 */
@WebMvcTest(EmployeeController.class)
@TestPropertySource(properties = "spring.datasource.url=jdbc:mariadb://127.0.0.1:1/no_db_in_webmvc_test")
class EmployeeControllerTest {

    private static final EmployeeResponse EMPLOYEE = new EmployeeResponse(
            1L, "E2026001", "김가상", "인사팀", "대리", "010-0000-0001", "kim@example.com",
            LocalDate.of(2026, 3, 2), EmploymentStatus.ACTIVE, null);

    private static final String VALID_CREATE_BODY = """
            {"employeeNo":"e2026001","name":"김가상","hireDate":"2026-03-02",
             "department":"인사팀","position":"대리","phone":"010-0000-0001","email":"kim@example.com"}
            """;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private EmployeeService employeeService;

    private static String updateBody(String status, String resignationDate) {
        String resignation = resignationDate == null ? "null" : "\"" + resignationDate + "\"";
        return """
                {"name":"김가상","hireDate":"2026-03-02","department":"인사팀","position":"과장",
                 "phone":null,"email":"kim@example.com","employmentStatus":"%s","resignationDate":%s}
                """.formatted(status, resignation);
    }

    @Test
    void 목록은_200과_직원_배열을_돌려준다() throws Exception {
        when(employeeService.getEmployees()).thenReturn(List.of(EMPLOYEE));

        mockMvc.perform(get("/api/employees"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].employeeNo").value("E2026001"))
                .andExpect(jsonPath("$[0].hireDate").value("2026-03-02"))
                .andExpect(jsonPath("$[0].employmentStatus").value("ACTIVE"))
                .andExpect(jsonPath("$[0].deletedAt").doesNotExist());
    }

    @Test
    void 상세는_200_없는_직원은_404_공통_오류_형식이다() throws Exception {
        when(employeeService.getEmployee(1L)).thenReturn(EMPLOYEE);
        when(employeeService.getEmployee(99L)).thenThrow(new BusinessException(ErrorCode.EMPLOYEE_NOT_FOUND));

        mockMvc.perform(get("/api/employees/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("김가상"));

        mockMvc.perform(get("/api/employees/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.code").value("EMPLOYEE_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("사원 정보를 찾을 수 없습니다."))
                .andExpect(jsonPath("$.fieldErrors", aMapWithSize(0)))
                .andExpect(jsonPath("$.path").value("/api/employees/99"))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void 숫자가_아닌_ID는_400이다() throws Exception {
        mockMvc.perform(get("/api/employees/abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors", hasKey("id")));
    }

    @Test
    void 등록은_201과_Location_헤더를_돌려준다() throws Exception {
        when(employeeService.createEmployee(any())).thenReturn(EMPLOYEE);

        mockMvc.perform(post("/api/employees").contentType(MediaType.APPLICATION_JSON).content(VALID_CREATE_BODY))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/employees/1"))
                .andExpect(jsonPath("$.employeeNo").value("E2026001"));
    }

    @Test
    void 등록_입력값_오류는_항목별_메시지와_400이다() throws Exception {
        String body = """
                {"employeeNo":"E 01","name":"  ","phone":"01012345678","email":"abc@"}
                """;

        mockMvc.perform(post("/api/employees").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors.employeeNo").value("사번은 공백 없이 영문·숫자 20자 이내로 입력해 주세요."))
                .andExpect(jsonPath("$.fieldErrors.name").value("이름을 입력해 주세요."))
                .andExpect(jsonPath("$.fieldErrors.hireDate").value("입사일을 입력해 주세요."))
                .andExpect(jsonPath("$.fieldErrors", hasKey("phone")))
                .andExpect(jsonPath("$.fieldErrors", hasKey("email")))
                // 입력값을 응답에 되돌려 보내지 않는다.
                .andExpect(content().string(not(containsString("01012345678"))));
        verifyNoInteractions(employeeService);
    }

    @Test
    void 사번_중복은_409다() throws Exception {
        when(employeeService.createEmployee(any())).thenThrow(new BusinessException(ErrorCode.EMPLOYEE_NO_DUPLICATED));

        mockMvc.perform(post("/api/employees").contentType(MediaType.APPLICATION_JSON).content(VALID_CREATE_BODY))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMPLOYEE_NO_DUPLICATED"));
    }

    @Test
    void 깨진_JSON이나_잘못된_날짜는_400이다() throws Exception {
        mockMvc.perform(post("/api/employees").contentType(MediaType.APPLICATION_JSON).content("{\"name\":"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"));

        mockMvc.perform(post("/api/employees").contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_CREATE_BODY.replace("2026-03-02", "2026-13-40")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        verifyNoInteractions(employeeService);
    }

    @Test
    void 수정은_200이다() throws Exception {
        when(employeeService.updateEmployee(eq(1L), any())).thenReturn(EMPLOYEE);

        mockMvc.perform(put("/api/employees/1").contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody("RESIGNED", "2026-12-31")))
                .andExpect(status().isOk());
    }

    @Test
    void 수정_요청의_사번은_조용히_무시한다() throws Exception {
        when(employeeService.updateEmployee(eq(1L), any())).thenReturn(EMPLOYEE);
        String body = updateBody("ACTIVE", null).replace("{\"name\"", "{\"employeeNo\":\"HACK01\",\"name\"");

        mockMvc.perform(put("/api/employees/1").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
        verify(employeeService).updateEmployee(eq(1L), any(EmployeeUpdateRequest.class));
    }

    @Test
    void 재직_상태인데_퇴사일이_있으면_400이다() throws Exception {
        mockMvc.perform(put("/api/employees/1").contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody("ACTIVE", "2026-12-31")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.resignationDate").value("재직 상태에서는 퇴사일을 비워 주세요."));
        verifyNoInteractions(employeeService);
    }

    @Test
    void 퇴사_상태인데_퇴사일이_없으면_400이다() throws Exception {
        mockMvc.perform(put("/api/employees/1").contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody("RESIGNED", null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.resignationDate").value("퇴사 상태에서는 퇴사일을 입력해 주세요."));
    }

    @Test
    void 퇴사일이_입사일보다_빠르면_400이다() throws Exception {
        mockMvc.perform(put("/api/employees/1").contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody("RESIGNED", "2026-03-01")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.resignationDate").value("퇴사일은 입사일보다 빠를 수 없습니다."));
    }

    @Test
    void 정의되지_않은_재직_상태는_400이다() throws Exception {
        mockMvc.perform(put("/api/employees/1").contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody("LEAVE", null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"));
    }

    @Test
    void 삭제는_204_없는_직원은_404다() throws Exception {
        mockMvc.perform(delete("/api/employees/1"))
                .andExpect(status().isNoContent());

        doThrow(new BusinessException(ErrorCode.EMPLOYEE_NOT_FOUND)).when(employeeService).deleteEmployee(99L);
        mockMvc.perform(delete("/api/employees/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EMPLOYEE_NOT_FOUND"));
    }

    @Test
    void 사번_중복_확인은_200이고_값이_없으면_400이다() throws Exception {
        when(employeeService.checkEmployeeNo("e2026001")).thenReturn(new EmployeeNoCheckResponse("E2026001", false));

        mockMvc.perform(get("/api/employees/employee-no/check").param("value", "e2026001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.employeeNo").value("E2026001"))
                .andExpect(jsonPath("$.available").value(false));

        mockMvc.perform(get("/api/employees/employee-no/check"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors", hasKey("value")));
    }

    @Test
    void 예상하지_못한_오류는_500이고_내부_정보를_숨긴다() throws Exception {
        when(employeeService.getEmployees()).thenThrow(new RuntimeException("internal detail: jdbc url"));

        mockMvc.perform(get("/api/employees"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andExpect(content().string(not(containsString("internal detail"))));
    }

    @Test
    void 지원하지_않는_요청_방식은_405다() throws Exception {
        mockMvc.perform(patch("/api/employees/1"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
    }

    @Test
    void 없는_API_주소는_404다() throws Exception {
        mockMvc.perform(get("/api/unknown"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }
}
