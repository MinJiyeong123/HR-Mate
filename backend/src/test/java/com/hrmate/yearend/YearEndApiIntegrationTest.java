package com.hrmate.yearend;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hrmate.employee.domain.Employee;
import com.hrmate.employee.repository.EmployeeRepository;
import com.hrmate.payroll.domain.PayItem;
import com.hrmate.payroll.repository.PayItemRepository;
import java.time.LocalDate;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
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
 * 연말정산 API 통합 테스트: API → 서비스 → 계산기·JPA → 테스트 DB(hr_mate_test, test 프로필)
 *
 * - 각 테스트는 트랜잭션 안에서 실행되고 끝나면 롤백된다. 개발 DB(hr_mate)에는 접속하지 않는다.
 * - 테스트용 사번은 ZZYEIT, 연도는 2099년(2025년 규칙 적용 경고 확인 포함)을 사용한다. 금액은 모두 가상 값이다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=validate")
class YearEndApiIntegrationTest {

    private static final String INPUT_BODY = """
            {"spouseDeduction":true,"dependentCount":1,"elderlyCount":0,"disabledCount":0,
             "womanDeduction":false,"singleParentDeduction":false,"childCreditCount":1,
             "birthFirstCount":0,"birthSecondCount":0,"birthThirdPlusCount":0}
            """;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private PayItemRepository payItemRepository;

    private Map<String, Long> itemIds;
    private Long employeeId;

    @BeforeEach
    void setUp() {
        itemIds = payItemRepository.findAllByActiveTrueOrderBySortOrderAsc().stream()
                .collect(Collectors.toMap(PayItem::getCode, PayItem::getId));
        employeeId = employeeRepository.saveAndFlush(
                Employee.create("ZZYEIT01", "연말통합", LocalDate.of(2020, 1, 1), "인사팀", "대리", null, null)).getId();
    }

    private String createPeriod(int month) throws Exception {
        return mockMvc.perform(post("/api/payroll-periods").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"year\":2099,\"month\":%d,\"paymentDate\":\"2099-%02d-25\"}".formatted(month, month)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getHeader("Location");
    }

    private String line(String code, long amount) {
        return "{\"payItemId\":%d,\"amount\":%d}".formatted(itemIds.get(code), amount);
    }

    private void createPayroll(String period, String... lines) throws Exception {
        mockMvc.perform(post(period + "/payrolls").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"employeeId\":%d,\"lines\":[%s]}".formatted(employeeId, String.join(",", lines))))
                .andExpect(status().isCreated());
    }

    private String base() {
        return "/api/year-end/2099/employees/" + employeeId;
    }

    @Test
    void 확정_급여와_입력_자료로_모의_계산한다() throws Exception {
        // 1월(확정): 기본급 4,000만, 식대 25만, 건강 10만, 장기요양 1만, 고용 2만, 국민연금 13만5천, 소득세 10만
        String january = createPeriod(1);
        createPayroll(january, line("BASE_SALARY", 40_000_000), line("MEAL_ALLOWANCE", 250_000),
                line("HEALTH_INSURANCE", 100_000), line("LONG_TERM_CARE", 10_000), line("EMPLOYMENT_INSURANCE", 20_000),
                line("NATIONAL_PENSION", 135_000), line("INCOME_TAX", 100_000));
        mockMvc.perform(post(january + "/confirm")).andExpect(status().isOk());
        // 2월(작성 중): 계산에서 제외
        createPayroll(createPeriod(2), line("BASE_SALARY", 9_000_000));

        // 입력 전: 기본값, 저장 안 됨
        mockMvc.perform(get(base() + "/input"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.saved").value(false))
                .andExpect(jsonPath("$.editable").value(true));

        // 입력 저장 (배우자 + 자녀 1명)
        mockMvc.perform(put(base() + "/input").contentType(MediaType.APPLICATION_JSON).content(INPUT_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.saved").value(true))
                .andExpect(jsonPath("$.updatedAt").exists());

        // 총급여 4,000만 → 근로소득공제 750만 + 2,500만 × 15% = 1,125만, 근로소득금액 2,875만
        // − 인적 450만 − 보험료 13만 − 국민연금 13만5천 = 과세표준 23,985,000
        // 산출세액 84만 + 9,985,000 × 15% = 2,337,750
        // 근로소득세액공제 min(71만5천 + 1,037,750 × 30% = 1,026,325, 74만 − 700만 × 8/1000 = 684,000) = 684,000
        // 자녀 25만 → 결정세액 2,337,750 − 934,000 = 1,403,750, 기납부 10만 → 추가 납부 1,303,750
        mockMvc.perform(get(base() + "/result"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.calculable").value(true))
                .andExpect(jsonPath("$.inputSaved").value(true))
                .andExpect(jsonPath("$.payrollCount").value(1))
                .andExpect(jsonPath("$.excludedDraftPayrollCount").value(1))
                .andExpect(jsonPath("$.sources.totalSalary").value(40_000_000))
                .andExpect(jsonPath("$.sources.nonTaxableEarnings").value(250_000))
                .andExpect(jsonPath("$.sources.nationalPension").value(135_000))
                .andExpect(jsonPath("$.calculation.rulesYear").value(2025))
                .andExpect(jsonPath("$.calculation.earnedIncomeDeduction").value(11_250_000))
                .andExpect(jsonPath("$.calculation.taxBase").value(23_985_000))
                .andExpect(jsonPath("$.calculation.calculatedTax").value(2_337_750))
                .andExpect(jsonPath("$.calculation.earnedIncomeTaxCredit").value(684_000))
                .andExpect(jsonPath("$.calculation.determinedTax").value(1_403_750))
                .andExpect(jsonPath("$.calculation.additionalPayment").value(1_303_750))
                .andExpect(jsonPath("$.warnings[0]").value(
                        "2099년 귀속 급여에 2025년 귀속 규칙을 적용한 결과입니다. 2099년 개정 사항은 반영되지 않았습니다."))
                .andExpect(jsonPath("$.warnings[1]").value(
                        "식대가 월 20만원을 넘는 달이 있습니다(1월). 비과세 한도 초과분의 과세 전환은 반영하지 않았습니다."))
                .andExpect(jsonPath("$.warnings[2]").value("작성 중인 급여 1건은 계산에서 제외했습니다."))
                .andExpect(jsonPath("$.assumptions.length()").value(3));

        // 목록
        mockMvc.perform(get("/api/year-end/2099/employees"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.employeeNo == 'ZZYEIT01')].inputSaved").value(true))
                .andExpect(jsonPath("$[?(@.employeeNo == 'ZZYEIT01')].balance").value(1_303_750));
    }

    @Test
    void 규칙_위반_입력과_삭제된_사원() throws Exception {
        String bothSelected = INPUT_BODY.replace("\"singleParentDeduction\":false", "\"singleParentDeduction\":true");
        mockMvc.perform(put(base() + "/input").contentType(MediaType.APPLICATION_JSON).content(bothSelected))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.input").value("배우자 기본공제와 한부모 공제는 함께 선택할 수 없습니다."));

        mockMvc.perform(delete("/api/employees/" + employeeId)).andExpect(status().isNoContent());
        mockMvc.perform(put(base() + "/input").contentType(MediaType.APPLICATION_JSON).content(INPUT_BODY))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("YEAR_END_INPUT_LOCKED"));
        mockMvc.perform(get(base() + "/result"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.employee.deleted").value(true))
                .andExpect(jsonPath("$.calculable").value(false));

        mockMvc.perform(get("/api/year-end/2099/employees/999999999/result"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EMPLOYEE_NOT_FOUND"));
        mockMvc.perform(get("/api/year-end/1999/employees"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.year").exists());
    }
}
