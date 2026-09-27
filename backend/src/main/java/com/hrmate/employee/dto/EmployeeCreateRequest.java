package com.hrmate.employee.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * 사원 등록 요청 (POST /api/employees)
 *
 * 재직 상태는 받지 않는다. 신규 사원은 항상 재직(ACTIVE)으로 등록된다.
 * 사번은 소문자로 보내도 대문자로 바꿔 저장한다.
 */
public record EmployeeCreateRequest(

        @NotBlank(message = "사번을 입력해 주세요.")
        @Pattern(regexp = ValidationPatterns.EMPLOYEE_NO, message = ValidationPatterns.EMPLOYEE_NO_MESSAGE)
        String employeeNo,

        @NotBlank(message = "이름을 입력해 주세요.")
        @Size(max = 50, message = "이름은 50자 이하로 입력해 주세요.")
        String name,

        @NotNull(message = "입사일을 입력해 주세요.")
        LocalDate hireDate,

        @Size(max = 100, message = "부서는 100자 이하로 입력해 주세요.")
        String department,

        @Size(max = 50, message = "직급은 50자 이하로 입력해 주세요.")
        String position,

        @Pattern(regexp = ValidationPatterns.PHONE, message = ValidationPatterns.PHONE_MESSAGE)
        String phone,

        @Email(message = "올바른 이메일 형식이 아닙니다.")
        @Size(max = 100, message = "이메일은 100자 이하로 입력해 주세요.")
        String email
) {
}
