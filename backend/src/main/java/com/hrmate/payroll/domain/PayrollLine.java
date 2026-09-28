package com.hrmate.payroll.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 급여 항목별 금액 (테이블: payroll_line)
 * 작성 당시 항목 이름·분류·과세 구분을 복사해 둔다. 금액은 1원 이상만 저장한다.
 * 생성·변경은 Payroll 을 통해서만 한다.
 */
@Entity
@Table(name = "payroll_line")
public class PayrollLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "payroll_id", nullable = false, updatable = false)
    private Payroll payroll;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pay_item_id", nullable = false, updatable = false)
    private PayItem payItem;

    @Column(name = "item_name", nullable = false, length = 50, updatable = false)
    private String itemName;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "category", nullable = false, length = 20, updatable = false)
    private PayItemCategory category;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tax_type", nullable = false, length = 20, updatable = false)
    private TaxType taxType;

    @Column(name = "amount", nullable = false)
    private long amount;

    /** JPA 전용 기본 생성자 */
    protected PayrollLine() {
    }

    PayrollLine(Payroll payroll, PayItem payItem, long amount) {
        this.payroll = payroll;
        this.payItem = payItem;
        this.itemName = payItem.getName();
        this.category = payItem.getCategory();
        this.taxType = payItem.getTaxType();
        this.amount = amount;
    }

    void changeAmount(long amount) {
        this.amount = amount;
    }

    String itemCode() {
        return payItem.getCode();
    }

    public boolean isEarning() {
        return category == PayItemCategory.EARNING;
    }

    public Long getId() {
        return id;
    }

    public PayItem getPayItem() {
        return payItem;
    }

    public String getItemName() {
        return itemName;
    }

    public PayItemCategory getCategory() {
        return category;
    }

    public TaxType getTaxType() {
        return taxType;
    }

    public long getAmount() {
        return amount;
    }
}
