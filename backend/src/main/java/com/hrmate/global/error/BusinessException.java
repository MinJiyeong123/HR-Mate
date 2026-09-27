package com.hrmate.global.error;

import java.util.Map;

/** 업무 규칙 위반. GlobalExceptionHandler 가 ErrorCode 에 맞는 오류 응답으로 바꾼다. */
public class BusinessException extends RuntimeException {

    private final ErrorCode errorCode;
    private final Map<String, String> fieldErrors;

    public BusinessException(ErrorCode errorCode) {
        this(errorCode, errorCode.getDefaultMessage(), Map.of());
    }

    public BusinessException(ErrorCode errorCode, String message) {
        this(errorCode, message, Map.of());
    }

    public BusinessException(ErrorCode errorCode, String message, Map<String, String> fieldErrors) {
        super(message);
        this.errorCode = errorCode;
        this.fieldErrors = Map.copyOf(fieldErrors);
    }

    /** 특정 입력 항목의 오류 (예: employeeNo) */
    public static BusinessException invalidField(String field, String message) {
        return new BusinessException(ErrorCode.INVALID_INPUT, ErrorCode.INVALID_INPUT.getDefaultMessage(),
                Map.of(field, message));
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }

    public Map<String, String> getFieldErrors() {
        return fieldErrors;
    }
}
