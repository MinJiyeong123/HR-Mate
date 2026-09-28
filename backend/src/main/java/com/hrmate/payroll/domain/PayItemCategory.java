package com.hrmate.payroll.domain;

/** 급여 항목 분류 */
public enum PayItemCategory {

    EARNING("지급"),
    DEDUCTION("공제");

    private final String label;

    PayItemCategory(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
