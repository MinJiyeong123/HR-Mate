package com.hrmate.payroll.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hrmate.employee.domain.Employee;
import com.hrmate.employee.repository.EmployeeRepository;
import com.hrmate.payroll.domain.PayItem;
import com.hrmate.payroll.domain.PayItemCategory;
import com.hrmate.payroll.domain.Payroll;
import com.hrmate.payroll.domain.PayrollLine;
import com.hrmate.payroll.domain.PayrollLineInput;
import com.hrmate.payroll.domain.PayrollPeriod;
import com.hrmate.payroll.domain.PayrollPeriodStatus;
import com.hrmate.payroll.domain.TaxType;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * 급여 테이블(V2 마이그레이션)과 급여 리포지토리 검증
 *
 * - 테스트 DB(hr_mate_test, test 프로필)에서만 실행한다. 개발 DB(hr_mate)에는 접속하지 않는다.
 * - 각 테스트는 끝나면 롤백되어 데이터가 남지 않는다. (기본 항목 12개는 V2 마이그레이션 데이터)
 * - 테스트용 사번은 ZZPAY 로 시작하고, 연도는 2099년을 사용한다.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=validate")
class PayrollRepositoryTest {

    private static final LocalDate PAYMENT_DATE = LocalDate.of(2099, 1, 25);

    @Autowired
    private PayItemRepository payItemRepository;

    @Autowired
    private PayrollPeriodRepository payrollPeriodRepository;

    @Autowired
    private PayrollRepository payrollRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private EntityManager entityManager;

    private Map<String, PayItem> items;

    @BeforeEach
    void loadItems() {
        items = payItemRepository.findAllByActiveTrueOrderBySortOrderAsc().stream()
                .collect(Collectors.toMap(PayItem::getCode, Function.identity()));
    }

    private Employee employee(String employeeNo) {
        return employeeRepository.saveAndFlush(
                Employee.create(employeeNo, "급여테스트", LocalDate.of(2020, 1, 1), "인사팀", "대리", null, null));
    }

    private PayrollPeriod period(int month) {
        return payrollPeriodRepository.saveAndFlush(PayrollPeriod.create(2099, month, PAYMENT_DATE));
    }

    private PayrollLineInput line(String code, long amount) {
        return new PayrollLineInput(items.get(code), amount);
    }

    private Payroll savePayroll(PayrollPeriod period, Employee employee, PayrollLineInput... lines) {
        return payrollRepository.saveAndFlush(Payroll.create(period, employee, List.of(lines), null));
    }

    private void nativeUpdate(String sql, Object... params) {
        var query = entityManager.createNativeQuery(sql);
        for (int i = 0; i < params.length; i++) {
            query.setParameter(i + 1, params[i]);
        }
        query.executeUpdate();
    }

    private long count(String sql, Object param) {
        return ((Number) entityManager.createNativeQuery(sql).setParameter(1, param).getSingleResult()).longValue();
    }

    private static void assertViolates(Runnable action, String constraintName) {
        assertThatThrownBy(action::run).hasStackTraceContaining(constraintName);
    }

    @Test
    void 기본_항목_12개가_표시_순서대로_등록되어_있다() {
        List<PayItem> list = payItemRepository.findAllByActiveTrueOrderBySortOrderAsc();

        assertThat(list).extracting(PayItem::getCode).containsExactly(
                "BASE_SALARY", "OVERTIME_PAY", "BONUS", "MEAL_ALLOWANCE", "OTHER_ALLOWANCE",
                "INCOME_TAX", "LOCAL_INCOME_TAX", "NATIONAL_PENSION", "HEALTH_INSURANCE",
                "LONG_TERM_CARE", "EMPLOYMENT_INSURANCE", "OTHER_DEDUCTION");
        assertThat(list).filteredOn(PayItem::isEarning).hasSize(5);
        assertThat(list).filteredOn(item -> item.getCategory() == PayItemCategory.DEDUCTION)
                .allSatisfy(item -> assertThat(item.getTaxType()).isEqualTo(TaxType.NONE))
                .hasSize(7);
        assertThat(items.get("MEAL_ALLOWANCE").getTaxType()).isEqualTo(TaxType.NON_TAXABLE);
    }

    @Test
    void 급여를_저장하고_항목과_합계를_다시_읽을_수_있다() {
        Employee employee = employee("ZZPAY001");
        PayrollPeriod period = period(1);
        Payroll saved = savePayroll(period, employee,
                line("BASE_SALARY", 3_000_000), line("MEAL_ALLOWANCE", 200_000), line("INCOME_TAX", 100_000));
        entityManager.clear();

        List<Payroll> payrolls = payrollRepository.findAllByPeriod_IdOrderByEmployeeNoAsc(period.getId());
        assertThat(payrolls).hasSize(1);
        Payroll found = payrolls.get(0);
        assertThat(found.getId()).isEqualTo(saved.getId());
        assertThat(found.getEmployeeNo()).isEqualTo("ZZPAY001");
        assertThat(found.getTotalEarnings()).isEqualTo(3_200_000L);
        assertThat(found.getTotalDeductions()).isEqualTo(100_000L);
        assertThat(found.getNetPay()).isEqualTo(3_100_000L);
        assertThat(found.getLines()).hasSize(3);
        assertThat(found.getCreatedAt()).isNotNull();

        assertThat(payrollRepository.existsByPeriod_IdAndEmployee_Id(period.getId(), employee.getId())).isTrue();
        assertThat(payrollRepository.countByPeriod_Id(period.getId())).isEqualTo(1);
        assertThat(payrollRepository.findAllByEmployee_IdAndPeriod_PayYearOrderByPeriod_PayMonthAsc(employee.getId(), 2099))
                .hasSize(1);
        assertThat(payrollPeriodRepository.existsByPayYearAndPayMonth(2099, 1)).isTrue();
    }

    @Test
    void 연간_집계_조회는_귀속_연도와_기간_상태로_거르고_항목을_함께_읽는다() {
        Employee first = employee("ZZPAY011");
        Employee second = employee("ZZPAY012");
        PayrollPeriod january = period(1);
        PayrollPeriod february = period(2);
        PayrollPeriod otherYear = payrollPeriodRepository.saveAndFlush(PayrollPeriod.create(2098, 1, LocalDate.of(2098, 1, 25)));
        savePayroll(january, second, line("BASE_SALARY", 1_000));
        savePayroll(january, first, line("BASE_SALARY", 2_000), line("MEAL_ALLOWANCE", 300));
        savePayroll(february, first, line("BASE_SALARY", 2_000));
        savePayroll(otherYear, first, line("BASE_SALARY", 9_000));
        january.confirm(2);
        otherYear.confirm(1);
        payrollPeriodRepository.flush();
        entityManager.clear();

        List<Payroll> confirmed = payrollRepository.findAllForAnnual(2099, PayrollPeriodStatus.CONFIRMED);
        assertThat(confirmed).extracting(Payroll::getEmployeeNo).containsExactly("ZZPAY011", "ZZPAY012");
        assertThat(confirmed.get(0).getLines()).hasSize(2);
        assertThat(payrollRepository.findAllForAnnual(2099, PayrollPeriodStatus.DRAFT))
                .extracting(payroll -> payroll.getPeriod().getPayMonth()).containsExactly(2);

        assertThat(payrollRepository.findAllForAnnualByEmployee(first.getId(), 2099, PayrollPeriodStatus.CONFIRMED))
                .extracting(Payroll::getTotalEarnings).containsExactly(2_300L);
        assertThat(payrollRepository.countByEmployee_IdAndPeriod_PayYearAndPeriod_Status(
                first.getId(), 2099, PayrollPeriodStatus.DRAFT)).isEqualTo(1);
        assertThat(payrollPeriodRepository.countByPayYearAndStatus(2099, PayrollPeriodStatus.CONFIRMED)).isEqualTo(1);
        assertThat(payrollPeriodRepository.countByPayYearAndStatus(2099, PayrollPeriodStatus.DRAFT)).isEqualTo(1);
    }

    @Test
    void 항목을_바꿔도_중복_제약에_걸리지_않는다() {
        Payroll payroll = savePayroll(period(1), employee("ZZPAY002"),
                line("BASE_SALARY", 3_000_000), line("MEAL_ALLOWANCE", 200_000));

        payroll.changeLines(List.of(line("BASE_SALARY", 3_100_000), line("BONUS", 500_000)));
        payrollRepository.flush();
        entityManager.clear();

        Payroll found = payrollRepository.findById(payroll.getId()).orElseThrow();
        assertThat(found.getLines()).extracting(PayrollLine::getItemName).containsExactlyInAnyOrder("기본급", "상여금");
        assertThat(found.getTotalEarnings()).isEqualTo(3_600_000L);
    }

    @Test
    void 급여를_삭제하면_항목도_함께_삭제된다() {
        Payroll payroll = savePayroll(period(1), employee("ZZPAY003"), line("BASE_SALARY", 1_000), line("INCOME_TAX", 100));
        Long payrollId = payroll.getId();

        payrollRepository.delete(payroll);
        payrollRepository.flush();

        assertThat(count("SELECT COUNT(*) FROM payroll_line WHERE payroll_id = ?1", payrollId)).isZero();
    }

    @Test
    void 같은_연월의_급여_기간은_만들_수_없다() {
        period(2);

        assertThatThrownBy(() -> period(2))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasStackTraceContaining("uk_payroll_period_year_month");
    }

    @Test
    void 같은_기간에_같은_사원의_급여는_하나만_가능하다() {
        Employee employee = employee("ZZPAY004");
        PayrollPeriod period = period(3);
        savePayroll(period, employee, line("BASE_SALARY", 1_000));

        assertThatThrownBy(() -> savePayroll(period, employee, line("BASE_SALARY", 2_000)))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasStackTraceContaining("uk_payroll_period_employee");
    }

    @Test
    void 급여가_참조하는_사원_행은_삭제할_수_없다() {
        Employee employee = employee("ZZPAY005");
        savePayroll(period(4), employee, line("BASE_SALARY", 1_000));

        assertViolates(() -> nativeUpdate("DELETE FROM employee WHERE id = ?1", employee.getId()), "fk_payroll_employee");
    }

    @Test
    void 사용된_항목은_삭제할_수_없다() {
        savePayroll(period(5), employee("ZZPAY006"), line("BASE_SALARY", 1_000));

        assertViolates(() -> nativeUpdate("DELETE FROM pay_item WHERE code = 'BASE_SALARY'"), "fk_payroll_line_pay_item");
    }

    @Test
    void DB는_잘못된_월을_거부한다() {
        assertViolates(() -> nativeUpdate("""
                INSERT INTO payroll_period (pay_year, pay_month, payment_date, status, created_at, updated_at)
                VALUES (2099, 13, '2099-01-25', 'DRAFT', NOW(6), NOW(6))
                """), "ck_payroll_period_month");
    }

    @Test
    void DB는_맞지_않는_합계를_거부한다() {
        Employee employee = employee("ZZPAY007");
        PayrollPeriod period = period(6);

        assertViolates(() -> nativeUpdate("""
                INSERT INTO payroll (payroll_period_id, employee_id, employee_no, employee_name,
                                     total_earnings, total_deductions, net_pay, created_at, updated_at)
                VALUES (?1, ?2, 'ZZPAY007', '급여테스트', 1000, 100, 1000, NOW(6), NOW(6))
                """, period.getId(), employee.getId()), "ck_payroll_totals");
    }

    @Test
    void DB는_음수_실지급액을_거부한다() {
        Employee employee = employee("ZZPAY008");
        PayrollPeriod period = period(7);

        assertViolates(() -> nativeUpdate("""
                INSERT INTO payroll (payroll_period_id, employee_id, employee_no, employee_name,
                                     total_earnings, total_deductions, net_pay, created_at, updated_at)
                VALUES (?1, ?2, 'ZZPAY008', '급여테스트', 100, 200, -100, NOW(6), NOW(6))
                """, period.getId(), employee.getId()), "ck_payroll_totals");
    }

    @Test
    void DB는_0원_항목과_분류가_맞지_않는_항목을_거부한다() {
        Payroll payroll = savePayroll(period(8), employee("ZZPAY009"), line("BASE_SALARY", 1_000));
        Long bonusId = items.get("BONUS").getId();

        assertViolates(() -> nativeUpdate("""
                INSERT INTO payroll_line (payroll_id, pay_item_id, item_name, category, tax_type, amount)
                VALUES (?1, ?2, '상여금', 'EARNING', 'TAXABLE', 0)
                """, payroll.getId(), bonusId), "ck_payroll_line_amount");
    }

    @Test
    void DB는_지급_항목의_과세_구분_누락을_거부한다() {
        Payroll payroll = savePayroll(period(9), employee("ZZPAY010"), line("BASE_SALARY", 1_000));
        Long bonusId = items.get("BONUS").getId();

        assertViolates(() -> nativeUpdate("""
                INSERT INTO payroll_line (payroll_id, pay_item_id, item_name, category, tax_type, amount)
                VALUES (?1, ?2, '상여금', 'EARNING', 'NONE', 1000)
                """, payroll.getId(), bonusId), "ck_payroll_line_tax_type");
    }

    @Test
    void DB는_분류와_과세_구분이_맞지_않는_항목_정의를_거부한다() {
        assertViolates(() -> nativeUpdate("""
                INSERT INTO pay_item (code, name, category, tax_type, sort_order, active)
                VALUES ('ZZ_WRONG', '잘못된 항목', 'DEDUCTION', 'TAXABLE', 999, TRUE)
                """), "ck_pay_item_tax_type");
    }
}
