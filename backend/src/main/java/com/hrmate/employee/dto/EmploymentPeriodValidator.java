package com.hrmate.employee.dto;

import com.hrmate.employee.domain.EmploymentStatus;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/**
 * 재직: 퇴사일이 비어 있어야 한다.
 * 퇴사: 퇴사일 필수, 입사일보다 빠를 수 없다.
 * (같은 규칙을 Employee.changeEmployment 와 DB CHECK 제약도 한 번 더 확인한다.)
 */
public class EmploymentPeriodValidator implements ConstraintValidator<ValidEmploymentPeriod, EmployeeUpdateRequest> {

    @Override
    public boolean isValid(EmployeeUpdateRequest request, ConstraintValidatorContext context) {
        if (request == null || request.employmentStatus() == null) {
            return true; // 재직 상태 누락은 @NotNull 이 보고한다.
        }

        String message = null;
        if (request.employmentStatus() == EmploymentStatus.ACTIVE && request.resignationDate() != null) {
            message = "재직 상태에서는 퇴사일을 비워 주세요.";
        } else if (request.employmentStatus() == EmploymentStatus.RESIGNED) {
            if (request.resignationDate() == null) {
                message = "퇴사 상태에서는 퇴사일을 입력해 주세요.";
            } else if (request.hireDate() != null && request.resignationDate().isBefore(request.hireDate())) {
                message = "퇴사일은 입사일보다 빠를 수 없습니다.";
            }
        }

        if (message == null) {
            return true;
        }
        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate(message)
                .addPropertyNode("resignationDate")
                .addConstraintViolation();
        return false;
    }
}
