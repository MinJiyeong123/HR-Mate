package com.hrmate.payroll.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 급여 기간 (테이블: payroll_period) - 귀속 연월당 1개
 *
 * <ul>
 *   <li>작성 중(DRAFT)일 때만 지급일 수정, 급여 입력·수정·삭제가 가능하다.</li>
 *   <li>급여가 1건 이상일 때만 확정할 수 있고, 확정 취소도 가능하다. (이력은 기록하지 않음)</li>
 * </ul>
 * 입력 오류는 IllegalArgumentException, 상태 위반은 IllegalStateException 을 던진다.
 */
@Entity
@Table(name = "payroll_period")
public class PayrollPeriod {

    public static final int MIN_YEAR = 2000;
    public static final int MAX_YEAR = 2100;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "pay_year", nullable = false, updatable = false)
    private int payYear;

    @Column(name = "pay_month", nullable = false, updatable = false)
    private int payMonth;

    @Column(name = "payment_date", nullable = false)
    private LocalDate paymentDate;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 20)
    private PayrollPeriodStatus status;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /** JPA 전용 기본 생성자 */
    protected PayrollPeriod() {
    }

    /** 급여 기간 생성. 작성 중 상태로 시작한다. */
    public static PayrollPeriod create(int year, int month, LocalDate paymentDate) {
        if (year < MIN_YEAR || year > MAX_YEAR) {
            throw new IllegalArgumentException("연도는 " + MIN_YEAR + "~" + MAX_YEAR + " 사이로 입력해 주세요.");
        }
        if (month < 1 || month > 12) {
            throw new IllegalArgumentException("월은 1~12 사이로 입력해 주세요.");
        }
        requirePaymentDate(paymentDate);

        PayrollPeriod period = new PayrollPeriod();
        period.payYear = year;
        period.payMonth = month;
        period.paymentDate = paymentDate;
        period.status = PayrollPeriodStatus.DRAFT;
        return period;
    }

    public YearMonth yearMonth() {
        return YearMonth.of(payYear, payMonth);
    }

    public void changePaymentDate(LocalDate paymentDate) {
        assertEditable();
        requirePaymentDate(paymentDate);
        this.paymentDate = paymentDate;
    }

    /** 확정. 급여가 1건 이상 있어야 한다. */
    public void confirm(long payrollCount) {
        if (isConfirmed()) {
            throw new IllegalStateException("이미 확정된 급여 기간입니다.");
        }
        if (payrollCount < 1) {
            throw new IllegalStateException("급여 내역이 1건 이상 있어야 확정할 수 있습니다.");
        }
        this.status = PayrollPeriodStatus.CONFIRMED;
        this.confirmedAt = LocalDateTime.now();
    }

    /** 확정 취소. 작성 중 상태로 되돌린다. */
    public void reopen() {
        if (!isConfirmed()) {
            throw new IllegalStateException("확정되지 않은 급여 기간입니다.");
        }
        this.status = PayrollPeriodStatus.DRAFT;
        this.confirmedAt = null;
    }

    /** 작성 중이 아니면 변경할 수 없다. */
    public void assertEditable() {
        if (isConfirmed()) {
            throw new IllegalStateException("확정된 급여 기간은 변경할 수 없습니다. 확정을 취소한 뒤 수정해 주세요.");
        }
    }

    public boolean isConfirmed() {
        return status == PayrollPeriodStatus.CONFIRMED;
    }

    private static void requirePaymentDate(LocalDate paymentDate) {
        if (paymentDate == null) {
            throw new IllegalArgumentException("지급일을 입력해 주세요.");
        }
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

    public int getPayYear() {
        return payYear;
    }

    public int getPayMonth() {
        return payMonth;
    }

    public LocalDate getPaymentDate() {
        return paymentDate;
    }

    public PayrollPeriodStatus getStatus() {
        return status;
    }

    public LocalDateTime getConfirmedAt() {
        return confirmedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
