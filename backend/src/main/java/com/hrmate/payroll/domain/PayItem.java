package com.hrmate.payroll.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 지급·공제 항목 (테이블: pay_item, 기본 항목은 V2 마이그레이션으로 등록)
 * 이번 단계에서는 화면에서 추가·수정하지 않는 기준 데이터다.
 */
@Entity
@Table(name = "pay_item")
public class PayItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code", nullable = false, length = 40, updatable = false)
    private String code;

    @Column(name = "name", nullable = false, length = 50)
    private String name;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "category", nullable = false, length = 20)
    private PayItemCategory category;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tax_type", nullable = false, length = 20)
    private TaxType taxType;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "active", nullable = false)
    private boolean active;

    /** JPA 전용 기본 생성자 */
    protected PayItem() {
    }

    /** 항목 생성 (테스트·기준 데이터용). 지급은 과세/비과세, 공제는 NONE 이어야 한다. */
    public static PayItem of(String code, String name, PayItemCategory category, TaxType taxType, int sortOrder) {
        boolean validTaxType = category == PayItemCategory.EARNING
                ? taxType == TaxType.TAXABLE || taxType == TaxType.NON_TAXABLE
                : taxType == TaxType.NONE;
        if (!validTaxType) {
            throw new IllegalArgumentException("항목 분류와 과세 구분이 맞지 않습니다.");
        }
        PayItem item = new PayItem();
        item.code = code;
        item.name = name;
        item.category = category;
        item.taxType = taxType;
        item.sortOrder = sortOrder;
        item.active = true;
        return item;
    }

    public boolean isEarning() {
        return category == PayItemCategory.EARNING;
    }

    public Long getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public PayItemCategory getCategory() {
        return category;
    }

    public TaxType getTaxType() {
        return taxType;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public boolean isActive() {
        return active;
    }
}
