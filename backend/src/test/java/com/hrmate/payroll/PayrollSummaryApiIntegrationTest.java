package com.hrmate.payroll;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
 * 연간 급여 집계 API 통합 테스트: API → 서비스 → JPA → 테스트 DB(hr_mate_test, test 프로필)
 *
 * - 각 테스트는 트랜잭션 안에서 실행되고 끝나면 롤백된다. 개발 DB(hr_mate)에는 접속하지 않는다.
 * - 테스트용 사번은 ZZSUMIT, 연도는 2099년(다른 연도 확인용 2098년)을 사용한다. 금액은 모두 가상 값이다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=validate")
class PayrollSummaryApiIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private PayItemRepository payItemRepository;

    private Map<String, Long> itemIds;
    private Long firstId;
    private Long secondId;

    @BeforeEach
    void setUp() {
        itemIds = payItemRepository.findAllByActiveTrueOrderBySortOrderAsc().stream()
                .collect(Collectors.toMap(PayItem::getCode, PayItem::getId));
        firstId = employeeRepository.saveAndFlush(
                Employee.create("ZZSUMIT01", "집계가상", LocalDate.of(2020, 1, 1), "인사팀", "대리", null, null)).getId();
        secondId = employeeRepository.saveAndFlush(
                Employee.create("ZZSUMIT02", "삭제가상", LocalDate.of(2020, 1, 1), "개발팀", "사원", null, null)).getId();
    }

    private String createPeriod(int year, int month, String paymentDate) throws Exception {
        return mockMvc.perform(post("/api/payroll-periods").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"year\":%d,\"month\":%d,\"paymentDate\":\"%s\"}".formatted(year, month, paymentDate)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getHeader("Location");
    }

    private void createPayroll(String period, Long employeeId, long base, long meal, long tax) throws Exception {
        mockMvc.perform(post(period + "/payrolls").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"employeeId":%d,"lines":[
                                  {"payItemId":%d,"amount":%d},{"payItemId":%d,"amount":%d},{"payItemId":%d,"amount":%d}]}
                                """.formatted(employeeId, itemIds.get("BASE_SALARY"), base,
                                itemIds.get("MEAL_ALLOWANCE"), meal, itemIds.get("INCOME_TAX"), tax)))
                .andExpect(status().isCreated());
    }

    private void confirm(String period) throws Exception {
        mockMvc.perform(post(period + "/confirm")).andExpect(status().isOk());
    }

    @Test
    void 확정된_기간만_귀속_연도로_합산하고_삭제된_사원도_표시한다() throws Exception {
        String january = createPeriod(2099, 1, "2099-01-25");
        createPayroll(january, firstId, 3_000_000, 200_000, 100_000);
        createPayroll(january, secondId, 2_000_000, 0, 50_000);
        confirm(january);

        // 12월분을 다음 해 1월에 지급 → 2099년 귀속으로 합산
        String december = createPeriod(2099, 12, "2100-01-10");
        createPayroll(december, firstId, 3_100_000, 200_000, 110_000);
        confirm(december);

        // 작성 중 기간은 제외, 다른 연도도 제외
        String november = createPeriod(2099, 11, "2099-11-25");
        createPayroll(november, firstId, 9_000_000, 0, 0);
        String otherYear = createPeriod(2098, 12, "2098-12-25");
        createPayroll(otherYear, firstId, 7_000_000, 0, 0);
        confirm(otherYear);

        mockMvc.perform(delete("/api/employees/" + secondId)).andExpect(status().isNoContent());

        mockMvc.perform(get("/api/payroll-summaries/annual").param("year", "2099"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.confirmedPeriodCount").value(2))
                .andExpect(jsonPath("$.excludedDraftPeriodCount").value(1))
                .andExpect(jsonPath("$.totals.totalEarnings").value(8_500_000))
                .andExpect(jsonPath("$.totals.taxableEarnings").value(8_100_000))
                .andExpect(jsonPath("$.totals.nonTaxableEarnings").value(400_000))
                .andExpect(jsonPath("$.totals.totalDeductions").value(260_000))
                .andExpect(jsonPath("$.totals.netPay").value(8_240_000))
                .andExpect(jsonPath("$.employees.length()").value(2))
                .andExpect(jsonPath("$.employees[0].employeeNo").value("ZZSUMIT01"))
                .andExpect(jsonPath("$.employees[0].payrollCount").value(2))
                .andExpect(jsonPath("$.employees[0].deleted").value(false))
                .andExpect(jsonPath("$.employees[1].employeeNo").value("ZZSUMIT02"))
                .andExpect(jsonPath("$.employees[1].deleted").value(true));

        mockMvc.perform(get("/api/payroll-summaries/annual/employees/" + firstId).param("year", "2099"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.excludedDraftPayrollCount").value(1))
                .andExpect(jsonPath("$.months.length()").value(2))
                .andExpect(jsonPath("$.months[1].month").value(12))
                .andExpect(jsonPath("$.months[1].paymentDate").value("2100-01-10"))
                .andExpect(jsonPath("$.totals.netPay").value(6_290_000))
                .andExpect(jsonPath("$.items[0].itemName").value("기본급"))
                .andExpect(jsonPath("$.items[0].amount").value(6_100_000))
                .andExpect(jsonPath("$.items[1].taxType").value("NON_TAXABLE"))
                .andExpect(jsonPath("$.items[1].amount").value(400_000));

        mockMvc.perform(get("/api/payroll-summaries/annual/employees/" + secondId).param("year", "2099"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(true))
                .andExpect(jsonPath("$.totals.netPay").value(1_950_000));
    }

    @Test
    void 확정_급여가_없으면_합계_0이고_없는_사원은_404_잘못된_연도는_400이다() throws Exception {
        mockMvc.perform(get("/api/payroll-summaries/annual").param("year", "2099"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totals.netPay").value(0))
                .andExpect(jsonPath("$.employees.length()").value(0));
        mockMvc.perform(get("/api/payroll-summaries/annual/employees/999999999").param("year", "2099"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EMPLOYEE_NOT_FOUND"));
        mockMvc.perform(get("/api/payroll-summaries/annual").param("year", "1999"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.year").value("연도는 2000~2100 사이로 입력해 주세요."));
    }
}
