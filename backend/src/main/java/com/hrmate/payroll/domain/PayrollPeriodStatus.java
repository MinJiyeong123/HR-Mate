package com.hrmate.payroll.domain;

/** 급여 기간 상태 */
public enum PayrollPeriodStatus {

    DRAFT("작성 중"),
    CONFIRMED("확정");

    private final String label;

    PayrollPeriodStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
