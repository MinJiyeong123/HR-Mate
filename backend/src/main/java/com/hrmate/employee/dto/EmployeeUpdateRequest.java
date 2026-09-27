package com.hrmate.employee.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.hrmate.employee.domain.EmploymentStatus;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * 사원 수정 요청 (PUT /api/employees/{id}) - 모든 항목을 보내는 전체 수정
 *
 * 사번 항목이 없으므로 사번은 바꿀 수 없다.
 * 본문에 employeeNo 등 정의되지 않은 항목이 있으면 오류 없이 무시한다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@ValidEmploymentPeriod
public record EmployeeUpdateRequest(

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
        String email,

        @NotNull(message = "재직 상태를 선택해 주세요.")
        EmploymentStatus employmentStatus,

        LocalDate resignationDate
) {
}
