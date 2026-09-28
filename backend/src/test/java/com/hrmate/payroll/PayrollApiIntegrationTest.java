package com.hrmate.payroll;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
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
 * 급여 API 통합 테스트: API → 서비스 → JPA → 테스트 DB(hr_mate_test, test 프로필)
 *
 * - 각 테스트는 트랜잭션 안에서 실행되고 끝나면 롤백된다. (MockMvc 는 같은 스레드에서 실행)
 * - 개발 DB(hr_mate)에는 접속하지 않는다.
 * - 테스트용 사번은 ZZPAYIT, 연도는 2099년을 사용한다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=validate")
class PayrollApiIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private PayItemRepository payItemRepository;

    private Map<String, Long> itemIds;
    private Long activeId;
    private Long futureHireId;

    @BeforeEach
    void setUp() {
        itemIds = payItemRepository.findAllByActiveTrueOrderBySortOrderAsc().stream()
                .collect(Collectors.toMap(PayItem::getCode, PayItem::getId));
        activeId = employeeRepository.saveAndFlush(
                Employee.create("ZZPAYIT01", "급여통합", LocalDate.of(2020, 1, 1), "인사팀", "대리", null, null)).getId();
        futureHireId = employeeRepository.saveAndFlush(
                Employee.create("ZZPAYIT02", "다음달입사", LocalDate.of(2099, 2, 1), null, null, null, null)).getId();
    }

    private String createPeriod(int month) throws Exception {
        return mockMvc.perform(post("/api/payroll-periods").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"year\":2099,\"month\":%d,\"paymentDate\":\"2099-%02d-25\"}".formatted(month, month)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getHeader("Location");
    }

    private String payrollBody(Long employeeId, long base, long meal, long tax) {
        return """
                {"employeeId":%d,"lines":[
                  {"payItemId":%d,"amount":%d},{"payItemId":%d,"amount":%d},{"payItemId":%d,"amount":%d},
                  {"payItemId":%d,"amount":0}],"memo":"통합 테스트"}
                """.formatted(employeeId, itemIds.get("INCOME_TAX"), tax, itemIds.get("MEAL_ALLOWANCE"), meal,
                itemIds.get("BASE_SALARY"), base, itemIds.get("BONUS"));
    }

    @Test
    void 기간_생성부터_입력_수정_확정_취소_삭제까지() throws Exception {
        String period = createPeriod(1);

        // 입력 가능한 사원: 1월 재직자만 (다음 달 입사자 제외)
        mockMvc.perform(get(period + "/eligible-employees"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].employeeNo", hasItem("ZZPAYIT01")))
                .andExpect(jsonPath("$[*].employeeNo", not(hasItem("ZZPAYIT02"))));

        // 급여 입력: 합계는 서버 계산, 0원 항목 제외, 항목은 표시 순서
        String payroll = mockMvc.perform(post(period + "/payrolls").contentType(MediaType.APPLICATION_JSON)
                        .content(payrollBody(activeId, 3_000_000, 200_000, 100_000)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.totalEarnings").value(3_200_000))
                .andExpect(jsonPath("$.totalDeductions").value(100_000))
                .andExpect(jsonPath("$.netPay").value(3_100_000))
                .andExpect(jsonPath("$.earnings.length()").value(2))
                .andExpect(jsonPath("$.earnings[0].itemName").value("기본급"))
                .andExpect(jsonPath("$.earnings[1].taxType").value("NON_TAXABLE"))
                .andExpect(jsonPath("$.employeeNo").value("ZZPAYIT01"))
                .andReturn().getResponse().getHeader("Location");

        // 같은 사원 중복 409, 대상 아닌 사원 400
        mockMvc.perform(post(period + "/payrolls").contentType(MediaType.APPLICATION_JSON)
                        .content(payrollBody(activeId, 1_000, 0, 0)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PAYROLL_DUPLICATED"));
        mockMvc.perform(post(period + "/payrolls").contentType(MediaType.APPLICATION_JSON)
                        .content(payrollBody(futureHireId, 1_000, 0, 0)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("EMPLOYEE_NOT_ELIGIBLE"));

        // 기간 상세 합계와 입력 후 대상 목록
        mockMvc.perform(get(period))
                .andExpect(jsonPath("$.payrollCount").value(1))
                .andExpect(jsonPath("$.totalNetPay").value(3_100_000))
                .andExpect(jsonPath("$.payrolls[0].employeeNo").value("ZZPAYIT01"));
        mockMvc.perform(get(period + "/eligible-employees"))
                .andExpect(jsonPath("$[*].employeeNo", not(hasItem("ZZPAYIT01"))));

        // 수정: 공제가 지급보다 크면 400, 정상 수정은 200
        mockMvc.perform(put(payroll).contentType(MediaType.APPLICATION_JSON)
                        .content(payrollBody(activeId, 100_000, 0, 200_000)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.lines").exists());
        mockMvc.perform(put(payroll).contentType(MediaType.APPLICATION_JSON)
                        .content(payrollBody(activeId, 3_100_000, 200_000, 120_000)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.netPay").value(3_180_000));

        // 확정 → 수정·삭제·입력 차단
        mockMvc.perform(post(period + "/confirm"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONFIRMED"));
        mockMvc.perform(put(payroll).contentType(MediaType.APPLICATION_JSON)
                        .content(payrollBody(activeId, 1_000, 0, 0)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PAYROLL_PERIOD_CONFIRMED"));
        mockMvc.perform(delete(payroll))
                .andExpect(status().isConflict());
        mockMvc.perform(put(period).contentType(MediaType.APPLICATION_JSON).content("{\"paymentDate\":\"2099-01-24\"}"))
                .andExpect(status().isConflict());

        // 확정 취소 → 삭제 가능 → 0건이면 확정 불가
        mockMvc.perform(post(period + "/reopen"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DRAFT"));
        mockMvc.perform(delete(payroll)).andExpect(status().isNoContent());
        mockMvc.perform(get(payroll)).andExpect(status().isNotFound());
        mockMvc.perform(post(period + "/confirm"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_PAYROLL_PERIOD_STATE"));
    }

    @Test
    void 같은_연월_기간은_409이고_목록에_합계가_나온다() throws Exception {
        String period = createPeriod(3);
        mockMvc.perform(post(period + "/payrolls").contentType(MediaType.APPLICATION_JSON)
                        .content(payrollBody(activeId, 2_000_000, 0, 50_000)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/payroll-periods").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"year\":2099,\"month\":3,\"paymentDate\":\"2099-03-25\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PAYROLL_PERIOD_DUPLICATED"));

        mockMvc.perform(get("/api/payroll-periods"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.year == 2099 && @.month == 3)].payrollCount").value(1))
                .andExpect(jsonPath("$[?(@.year == 2099 && @.month == 3)].totalNetPay").value(1_950_000));
    }

    @Test
    void 사원별_연간_내역과_항목_목록() throws Exception {
        String period = createPeriod(5);
        mockMvc.perform(post(period + "/payrolls").contentType(MediaType.APPLICATION_JSON)
                        .content(payrollBody(activeId, 1_500_000, 0, 0)))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/employees/" + activeId + "/payrolls").param("year", "2099"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].month").value(5))
                .andExpect(jsonPath("$[0].netPay").value(1_500_000));

        mockMvc.perform(get("/api/pay-items"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(12))
                .andExpect(jsonPath("$[0].code").value("BASE_SALARY"));
    }

    @Test
    void 없는_사원과_없는_항목() throws Exception {
        String period = createPeriod(7);

        mockMvc.perform(post(period + "/payrolls").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"employeeId\":999999999,\"lines\":[{\"payItemId\":%d,\"amount\":1000}]}"
                                .formatted(itemIds.get("BASE_SALARY"))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EMPLOYEE_NOT_FOUND"));
        mockMvc.perform(post(period + "/payrolls").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"employeeId\":%d,\"lines\":[{\"payItemId\":999999999,\"amount\":1000}]}"
                                .formatted(activeId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.lines").value("존재하지 않는 항목입니다: 999999999"));
    }
}
