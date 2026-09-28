package com.hrmate.global.error;

import org.springframework.http.HttpStatus;

/** API 오류 종류. 응답의 status, code, 기본 message 를 정한다. (docs/api/employee-api.md 참고) */
public enum ErrorCode {

    INVALID_INPUT(HttpStatus.BAD_REQUEST, "입력값을 확인해 주세요."),
    NOT_FOUND(HttpStatus.NOT_FOUND, "요청한 주소를 찾을 수 없습니다."),
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, "지원하지 않는 요청 방식입니다."),
    UNSUPPORTED_MEDIA_TYPE(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "지원하지 않는 요청 형식입니다. JSON으로 보내 주세요."),
    EMPLOYEE_NOT_FOUND(HttpStatus.NOT_FOUND, "사원 정보를 찾을 수 없습니다."),
    EMPLOYEE_NO_DUPLICATED(HttpStatus.CONFLICT, "이미 사용된 사번입니다."),
    EMPLOYEE_NOT_ELIGIBLE(HttpStatus.BAD_REQUEST, "해당 월에 재직한 사원만 급여를 입력할 수 있습니다."),
    PAYROLL_PERIOD_NOT_FOUND(HttpStatus.NOT_FOUND, "급여 기간을 찾을 수 없습니다."),
    PAYROLL_PERIOD_DUPLICATED(HttpStatus.CONFLICT, "같은 연월의 급여 기간이 이미 있습니다."),
    PAYROLL_PERIOD_CONFIRMED(HttpStatus.CONFLICT, "확정된 급여 기간은 변경할 수 없습니다. 확정을 취소한 뒤 수정해 주세요."),
    INVALID_PAYROLL_PERIOD_STATE(HttpStatus.CONFLICT, "급여 기간 상태를 확인해 주세요."),
    PAYROLL_NOT_FOUND(HttpStatus.NOT_FOUND, "급여 정보를 찾을 수 없습니다."),
    PAYROLL_DUPLICATED(HttpStatus.CONFLICT, "이 기간에 이미 급여가 입력된 사원입니다."),
    YEAR_END_INPUT_LOCKED(HttpStatus.CONFLICT, "삭제된 사원의 연말정산 자료는 저장할 수 없습니다."),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");

    private final HttpStatus status;
    private final String defaultMessage;

    ErrorCode(HttpStatus status, String defaultMessage) {
        this.status = status;
        this.defaultMessage = defaultMessage;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getDefaultMessage() {
        return defaultMessage;
    }
}
