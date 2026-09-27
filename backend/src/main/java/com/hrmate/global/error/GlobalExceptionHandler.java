package com.hrmate.global.error;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * 모든 API 예외를 ErrorResponse 형식으로 바꾼다.
 *
 * - 400/404/405/409/415: 경고 로그 한 줄만 남긴다. 요청 본문과 입력값은 로그에 남기지 않는다.
 * - 500: 원인은 서버 로그에만 남기고, 응답에는 일반 안내 문구만 보낸다.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusiness(BusinessException e, HttpServletRequest request) {
        return respond(e.getErrorCode(), e.getMessage(), e.getFieldErrors(), request);
    }

    /** @Valid 요청 본문 검증 실패 */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleNotValid(MethodArgumentNotValidException e, HttpServletRequest request) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (FieldError error : e.getBindingResult().getFieldErrors()) {
            fieldErrors.putIfAbsent(error.getField(), error.getDefaultMessage());
        }
        return respond(ErrorCode.INVALID_INPUT, ErrorCode.INVALID_INPUT.getDefaultMessage(), fieldErrors, request);
    }

    /** 깨진 JSON, 잘못된 날짜·재직 상태 값 등 본문을 읽을 수 없음 */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleNotReadable(HttpMessageNotReadableException e, HttpServletRequest request) {
        return respond(ErrorCode.INVALID_INPUT,
                "요청 형식이 올바르지 않습니다. JSON 형식과 날짜(YYYY-MM-DD), 재직 상태 값을 확인해 주세요.",
                Map.of(), request);
    }

    /** 경로·파라미터 타입 오류 (예: /api/employees/abc) */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException e, HttpServletRequest request) {
        return respond(ErrorCode.INVALID_INPUT, ErrorCode.INVALID_INPUT.getDefaultMessage(),
                Map.of(e.getName(), "형식이 올바르지 않습니다."), request);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingParameter(MissingServletRequestParameterException e, HttpServletRequest request) {
        return respond(ErrorCode.INVALID_INPUT, ErrorCode.INVALID_INPUT.getDefaultMessage(),
                Map.of(e.getParameterName(), "값을 입력해 주세요."), request);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoResource(NoResourceFoundException e, HttpServletRequest request) {
        return respond(ErrorCode.NOT_FOUND, ErrorCode.NOT_FOUND.getDefaultMessage(), Map.of(), request);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotSupported(HttpRequestMethodNotSupportedException e, HttpServletRequest request) {
        return respond(ErrorCode.METHOD_NOT_ALLOWED, ErrorCode.METHOD_NOT_ALLOWED.getDefaultMessage(), Map.of(), request);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMediaType(HttpMediaTypeNotSupportedException e, HttpServletRequest request) {
        return respond(ErrorCode.UNSUPPORTED_MEDIA_TYPE, ErrorCode.UNSUPPORTED_MEDIA_TYPE.getDefaultMessage(), Map.of(), request);
    }

    /** 예상하지 못한 오류: 내부 정보는 응답에 포함하지 않는다. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception e, HttpServletRequest request) {
        log.error("Unexpected error: {} {}", request.getMethod(), request.getRequestURI(), e);
        return build(ErrorCode.INTERNAL_ERROR, ErrorCode.INTERNAL_ERROR.getDefaultMessage(), Map.of(), request);
    }

    private ResponseEntity<ErrorResponse> respond(ErrorCode code, String message, Map<String, String> fieldErrors,
                                                  HttpServletRequest request) {
        log.warn("{} {} -> {} {}", request.getMethod(), request.getRequestURI(), code.getStatus().value(), code.name());
        return build(code, message, fieldErrors, request);
    }

    private ResponseEntity<ErrorResponse> build(ErrorCode code, String message, Map<String, String> fieldErrors,
                                                HttpServletRequest request) {
        return ResponseEntity.status(code.getStatus())
                .body(ErrorResponse.of(code, message, fieldErrors, request.getRequestURI()));
    }
}
