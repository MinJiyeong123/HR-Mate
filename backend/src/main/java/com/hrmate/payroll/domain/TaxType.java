package com.hrmate.payroll.domain;

/**
 * 과세 구분 (지급 항목만 과세/비과세, 공제 항목은 NONE)
 * 비과세는 분류 표시만 하며 법령상 한도·요건은 검사하지 않는다.
 */
public enum TaxType {

    TAXABLE("과세"),
    NON_TAXABLE("비과세"),
    NONE("-");

    private final String label;

    TaxType(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
