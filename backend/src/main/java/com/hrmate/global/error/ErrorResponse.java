package com.hrmate.global.error;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 공통 오류 응답
 *
 * <pre>
 * { "status": 400, "code": "INVALID_INPUT", "message": "입력값을 확인해 주세요.",
 *   "fieldErrors": { "name": "이름을 입력해 주세요." },
 *   "path": "/api/employees", "timestamp": "2026-09-28T10:15:30" }
 * </pre>
 *
 * 사용자가 입력한 값은 응답에 되돌려 보내지 않는다.
 */
public record ErrorResponse(
        int status,
        String code,
        String message,
        Map<String, String> fieldErrors,
        String path,
        LocalDateTime timestamp
) {

    public static ErrorResponse of(ErrorCode errorCode, String message, Map<String, String> fieldErrors, String path) {
        return new ErrorResponse(
                errorCode.getStatus().value(),
                errorCode.name(),
                message,
                fieldErrors,
                path,
                LocalDateTime.now());
    }
}
