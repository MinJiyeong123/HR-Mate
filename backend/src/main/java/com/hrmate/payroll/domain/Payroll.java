package com.hrmate.payroll.domain;

import com.hrmate.employee.domain.Employee;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 사원별 월 급여 (테이블: payroll) - 포트폴리오용 시뮬레이션
 *
 * <ul>
 *   <li>한 급여 기간에 사원당 1건. 해당 월에 재직한 사원만 대상이다.</li>
 *   <li>작성 당시 사번·이름·부서·직급을 복사해 둔다(스냅샷).</li>
 *   <li>합계·실지급액은 항목 금액으로 여기서 다시 계산한다. 세금·보험료는 계산하지 않는다.</li>
 *   <li>급여 기간이 확정되면 변경·삭제할 수 없다.</li>
 * </ul>
 * 입력 오류는 IllegalArgumentException, 상태 위반은 IllegalStateException 을 던진다.
 */
@Entity
@Table(name = "payroll")
public class Payroll {

    public static final long MAX_LINE_AMOUNT = 1_000_000_000L;
    public static final int MEMO_MAX_LENGTH = 200;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "payroll_period_id", nullable = false, updatable = false)
    private PayrollPeriod period;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "employee_id", nullable = false, updatable = false)
    private Employee employee;

    @Column(name = "employee_no", nullable = false, length = 20, updatable = false)
    private String employeeNo;

    @Column(name = "employee_name", nullable = false, length = 50, updatable = false)
    private String employeeName;

    @Column(name = "department", length = 100, updatable = false)
    private String department;

    @Column(name = "position", length = 50, updatable = false)
    private String position;

    @Column(name = "total_earnings", nullable = false)
    private long totalEarnings;

    @Column(name = "total_deductions", nullable = false)
    private long totalDeductions;

    @Column(name = "net_pay", nullable = false)
    private long netPay;

    @Column(name = "memo", length = MEMO_MAX_LENGTH)
    private String memo;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "payroll", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PayrollLine> lines = new ArrayList<>();

    /** JPA 전용 기본 생성자 */
    protected Payroll() {
    }

    /** 급여 생성: 작성 중인 기간 + 해당 월 재직 사원만 가능하다. */
    public static Payroll create(PayrollPeriod period, Employee employee, List<PayrollLineInput> inputs, String memo) {
        if (period == null || employee == null) {
            throw new IllegalArgumentException("급여 기간과 사원은 필수입니다.");
        }
        period.assertEditable();
        assertEligible(employee, period.yearMonth());

        Payroll payroll = new Payroll();
        payroll.period = period;
        payroll.employee = employee;
        payroll.employeeNo = employee.getEmployeeNo();
        payroll.employeeName = employee.getName();
        payroll.department = employee.getDepartment();
        payroll.position = employee.getPosition();
        payroll.memo = normalizeMemo(memo);
        payroll.applyLines(inputs);
        return payroll;
    }

    /**
     * 해당 월 재직 여부: 논리 삭제되지 않았고,
     * 입사일 ≤ 해당 월 말일, 퇴사일이 없거나 퇴사일 ≥ 해당 월 1일
     */
    public static boolean isEligible(Employee employee, YearMonth yearMonth) {
        if (employee.isDeleted()) {
            return false;
        }
        LocalDate firstDay = yearMonth.atDay(1);
        LocalDate lastDay = yearMonth.atEndOfMonth();
        LocalDate resignationDate = employee.getResignationDate();
        return !employee.getHireDate().isAfter(lastDay)
                && (resignationDate == null || !resignationDate.isBefore(firstDay));
    }

    private static void assertEligible(Employee employee, YearMonth yearMonth) {
        if (employee.isDeleted()) {
            throw new IllegalArgumentException("삭제된 사원에게는 급여를 입력할 수 없습니다.");
        }
        if (!isEligible(employee, yearMonth)) {
            throw new IllegalArgumentException("해당 월에 재직한 사원만 급여를 입력할 수 있습니다.");
        }
    }

    /** 항목 금액 변경 (같은 항목은 금액만 바꾸고, 빠진 항목은 삭제, 새 항목은 추가) */
    public void changeLines(List<PayrollLineInput> inputs) {
        period.assertEditable();
        applyLines(inputs);
    }

    public void changeMemo(String memo) {
        period.assertEditable();
        this.memo = normalizeMemo(memo);
    }

    /** 삭제 가능 여부: 급여 기간이 작성 중일 때만 삭제할 수 있다. */
    public void assertDeletable() {
        period.assertEditable();
    }

    private void applyLines(List<PayrollLineInput> inputs) {
        Map<String, PayrollLineInput> accepted = validateLines(inputs);

        long earnings = 0;
        long deductions = 0;
        for (PayrollLineInput input : accepted.values()) {
            if (input.payItem().isEarning()) {
                earnings += input.amount();
            } else {
                deductions += input.amount();
            }
        }
        if (earnings <= 0) {
            throw new IllegalArgumentException("지급 항목을 1개 이상 입력해 주세요.");
        }
        if (deductions > earnings) {
            throw new IllegalArgumentException("공제 합계가 지급 합계보다 클 수 없습니다. 실지급액은 0원 이상이어야 합니다.");
        }

        // 같은 항목은 금액만 바꾼다. (삭제 후 재등록하면 UNIQUE(payroll_id, pay_item_id) 위반이 날 수 있다)
        Map<String, PayrollLine> existing = lines.stream()
                .collect(Collectors.toMap(PayrollLine::itemCode, Function.identity()));
        lines.removeIf(line -> !accepted.containsKey(line.itemCode()));
        for (PayrollLineInput input : accepted.values()) {
            PayrollLine line = existing.get(input.payItem().getCode());
            if (line != null) {
                line.changeAmount(input.amount());
            } else {
                lines.add(new PayrollLine(this, input.payItem(), input.amount()));
            }
        }

        this.totalEarnings = earnings;
        this.totalDeductions = deductions;
        this.netPay = earnings - deductions;
    }

    /** 검사를 통과한 1원 이상 항목만 (항목 코드 → 입력값) */
    private static Map<String, PayrollLineInput> validateLines(List<PayrollLineInput> inputs) {
        if (inputs == null) {
            throw new IllegalArgumentException("급여 항목을 입력해 주세요.");
        }
        Set<String> seen = new HashSet<>();
        Map<String, PayrollLineInput> accepted = new LinkedHashMap<>();
        for (PayrollLineInput input : inputs) {
            if (input == null || input.payItem() == null) {
                throw new IllegalArgumentException("급여 항목을 선택해 주세요.");
            }
            PayItem item = input.payItem();
            if (!item.isActive()) {
                throw new IllegalArgumentException("사용하지 않는 항목입니다: " + item.getName());
            }
            if (!seen.add(item.getCode())) {
                throw new IllegalArgumentException("같은 항목을 두 번 입력할 수 없습니다: " + item.getName());
            }
            long amount = input.amount() == null ? 0 : input.amount();
            if (amount < 0) {
                throw new IllegalArgumentException("금액은 0원 이상으로 입력해 주세요: " + item.getName());
            }
            if (amount > MAX_LINE_AMOUNT) {
                throw new IllegalArgumentException("항목 금액은 1,000,000,000원 이하로 입력해 주세요: " + item.getName());
            }
            if (amount > 0) {
                accepted.put(item.getCode(), new PayrollLineInput(item, amount));
            }
        }
        return accepted;
    }

    private static String normalizeMemo(String memo) {
        if (memo == null || memo.isBlank()) {
            return null;
        }
        String trimmed = memo.trim();
        if (trimmed.length() > MEMO_MAX_LENGTH) {
            throw new IllegalArgumentException("메모는 " + MEMO_MAX_LENGTH + "자 이하로 입력해 주세요.");
        }
        return trimmed;
    }

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public PayrollPeriod getPeriod() {
        return period;
    }

    public Employee getEmployee() {
        return employee;
    }

    public String getEmployeeNo() {
        return employeeNo;
    }

    public String getEmployeeName() {
        return employeeName;
    }

    public String getDepartment() {
        return department;
    }

    public String getPosition() {
        return position;
    }

    public long getTotalEarnings() {
        return totalEarnings;
    }

    public long getTotalDeductions() {
        return totalDeductions;
    }

    public long getNetPay() {
        return netPay;
    }

    public String getMemo() {
        return memo;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public List<PayrollLine> getLines() {
        return Collections.unmodifiableList(lines);
    }
}
