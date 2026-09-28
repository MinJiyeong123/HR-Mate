package com.hrmate.payroll.dto;

import com.hrmate.employee.domain.Employee;
import com.hrmate.employee.domain.EmploymentStatus;

/** 급여를 입력할 수 있는 사원 (해당 월 재직, 삭제 안 됨, 아직 급여 없음) */
public record EligibleEmployeeResponse(
        Long id,
        String employeeNo,
        String name,
        String department,
        String position,
        EmploymentStatus employmentStatus
) {

    public static EligibleEmployeeResponse from(Employee employee) {
        return new EligibleEmployeeResponse(employee.getId(), employee.getEmployeeNo(), employee.getName(),
                employee.getDepartment(), employee.getPosition(), employee.getEmploymentStatus());
    }
}
