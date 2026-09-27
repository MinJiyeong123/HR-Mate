package com.hrmate.employee.dto;

import com.hrmate.employee.domain.Employee;
import com.hrmate.employee.domain.EmploymentStatus;
import java.time.LocalDate;

/**
 * 사원 응답. 프론트엔드 가짜 API(employeeApi.js)의 응답과 같은 항목을 쓴다.
 * 삭제 시각(deletedAt) 등 내부 관리 값은 포함하지 않는다.
 */
public record EmployeeResponse(
        Long id,
        String employeeNo,
        String name,
        String department,
        String position,
        String phone,
        String email,
        LocalDate hireDate,
        EmploymentStatus employmentStatus,
        LocalDate resignationDate
) {

    public static EmployeeResponse from(Employee employee) {
        return new EmployeeResponse(
                employee.getId(),
                employee.getEmployeeNo(),
                employee.getName(),
                employee.getDepartment(),
                employee.getPosition(),
                employee.getPhone(),
                employee.getEmail(),
                employee.getHireDate(),
                employee.getEmploymentStatus(),
                employee.getResignationDate());
    }
}
