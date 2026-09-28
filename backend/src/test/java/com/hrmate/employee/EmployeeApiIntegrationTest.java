package com.hrmate.employee;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * 사원 API 통합 테스트: API → 서비스 → JPA → 테스트 DB(hr_mate_test, test 프로필)
 *
 * 데이터 안전
 * - 각 테스트 메서드는 @Transactional 트랜잭션 안에서 실행되고, 끝나면 항상 롤백된다.
 * - MockMvc 는 실제 네트워크 없이 테스트와 같은 스레드에서 컨트롤러·서비스를 호출하므로
 *   서비스의 트랜잭션이 테스트 트랜잭션에 합류해 함께 롤백된다.
 *   (실제 HTTP 호출 방식은 롤백되지 않으므로 사용하지 않는다.)
 * - ddl-auto 는 validate 로 고정해 테이블을 만들거나 지우지 않는다.
 * - 테스트용 사번은 ZZTEST 로 시작한다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=validate")
class EmployeeApiIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    private static String createBody(String employeeNo) {
        return """
                {"employeeNo":"%s","name":"통합테스트","hireDate":"2026-03-02",
                 "department":"인사팀","position":"대리","phone":"010-0000-0000","email":"it@example.com"}
                """.formatted(employeeNo);
    }

    private static String updateBody(String status, String resignationDate) {
        String resignation = resignationDate == null ? "null" : "\"" + resignationDate + "\"";
        return """
                {"employeeNo":"ZZHACK01","name":"통합테스트","hireDate":"2026-03-02","department":"재무팀",
                 "position":"과장","phone":null,"email":"it@example.com",
                 "employmentStatus":"%s","resignationDate":%s}
                """.formatted(status, resignation);
    }

    /** 등록 후 Location 헤더에서 내부 ID 경로를 얻는다. */
    private String create(String employeeNo) throws Exception {
        return mockMvc.perform(post("/api/employees").contentType(MediaType.APPLICATION_JSON).content(createBody(employeeNo)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getHeader("Location");
    }

    @Test
    void 등록_조회_수정_퇴사정정_논리삭제_흐름() throws Exception {
        String location = create("zzit001");

        mockMvc.perform(get(location))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.employeeNo").value("ZZIT001"))
                .andExpect(jsonPath("$.employmentStatus").value("ACTIVE"));

        // 퇴사 처리 (본문의 employeeNo 는 무시되어 사번이 바뀌지 않아야 한다)
        mockMvc.perform(put(location).contentType(MediaType.APPLICATION_JSON).content(updateBody("RESIGNED", "2026-12-31")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.employeeNo").value("ZZIT001"))
                .andExpect(jsonPath("$.department").value("재무팀"))
                .andExpect(jsonPath("$.employmentStatus").value("RESIGNED"))
                .andExpect(jsonPath("$.resignationDate").value("2026-12-31"));

        // 퇴사 → 재직 정정
        mockMvc.perform(put(location).contentType(MediaType.APPLICATION_JSON).content(updateBody("ACTIVE", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.employmentStatus").value("ACTIVE"))
                .andExpect(jsonPath("$.resignationDate").doesNotExist());

        mockMvc.perform(get("/api/employees"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].employeeNo", hasItem("ZZIT001")));

        // 논리 삭제
        mockMvc.perform(delete(location)).andExpect(status().isNoContent());

        mockMvc.perform(get(location))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EMPLOYEE_NOT_FOUND"));
        mockMvc.perform(delete(location)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/employees"))
                .andExpect(jsonPath("$[*].employeeNo", not(hasItem("ZZIT001"))));

        // 삭제된 사원의 사번은 계속 사용 중
        mockMvc.perform(get("/api/employees/employee-no/check").param("value", "zzit001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.employeeNo").value("ZZIT001"))
                .andExpect(jsonPath("$.available").value(false));
        mockMvc.perform(post("/api/employees").contentType(MediaType.APPLICATION_JSON).content(createBody("ZZIT001")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMPLOYEE_NO_DUPLICATED"));
    }

    @Test
    void 대소문자만_다른_사번은_중복으로_거부한다() throws Exception {
        create("ZZIT002");

        mockMvc.perform(post("/api/employees").contentType(MediaType.APPLICATION_JSON).content(createBody("zzit002")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.fieldErrors.employeeNo").value("이미 사용된 사번입니다."));
    }

    @Test
    void 사용하지_않은_사번은_사용_가능하다() throws Exception {
        mockMvc.perform(get("/api/employees/employee-no/check").param("value", "ZZIT999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true));
    }

    @Test
    void DB_규칙_위반_수정은_400이고_저장되지_않는다() throws Exception {
        String location = create("ZZIT003");

        mockMvc.perform(put(location).contentType(MediaType.APPLICATION_JSON).content(updateBody("RESIGNED", "2026-01-01")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.resignationDate").exists());

        mockMvc.perform(get(location))
                .andExpect(jsonPath("$.employmentStatus").value("ACTIVE"))
                .andExpect(jsonPath("$.department").value("인사팀"));
    }
}
