package com.hrmate.employee.domain;

/**
 * 재직 상태. DB에는 이름(ACTIVE, RESIGNED) 그대로 문자열로 저장한다.
 * 프론트엔드 constants/employmentStatus.js 와 같은 값을 사용한다.
 */
public enum EmploymentStatus {

    ACTIVE("재직"),
    RESIGNED("퇴사");

    private final String label;

    EmploymentStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
