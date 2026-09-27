package com.hrmate.employee.dto;

/**
 * 요청 검증에 쓰는 정규식과 메시지.
 * 규칙 출처: docs/requirements-mvp1.md, 문구는 frontend/src/utils/employeeValidation.js 와 맞춘다.
 */
final class ValidationPatterns {

    /** 영문·숫자 1~20자 (소문자는 저장할 때 대문자로 변환) */
    static final String EMPLOYEE_NO = "^[A-Za-z0-9]{1,20}$";
    static final String EMPLOYEE_NO_MESSAGE = "사번은 공백 없이 영문·숫자 20자 이내로 입력해 주세요.";

    /** 빈 값 또는 010-1234-5678 / 02-123-4567 / 031-123-4567 */
    static final String PHONE = "^$|^0\\d{1,2}-\\d{3,4}-\\d{4}$";
    static final String PHONE_MESSAGE = "전화번호는 010-1234-5678 또는 02-123-4567 형식으로 입력해 주세요.";

    private ValidationPatterns() {
    }
}
