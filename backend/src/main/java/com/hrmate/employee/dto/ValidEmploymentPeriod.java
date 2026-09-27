package com.hrmate.employee.dto;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 재직 상태와 퇴사일의 조합 검증 (EmployeeUpdateRequest 에 사용)
 * 오류는 resignationDate 항목의 메시지로 보고된다.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = EmploymentPeriodValidator.class)
public @interface ValidEmploymentPeriod {

    String message() default "재직 상태와 퇴사일을 확인해 주세요.";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
