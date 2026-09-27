package com.hrmate.employee.dto;

/**
 * 사번 중복 확인 응답 (GET /api/employees/employee-no/check?value=...)
 *
 * @param employeeNo 대문자로 바꾼 사번 (화면에서 확인 기준 값으로 사용)
 * @param available  사용 가능하면 true. 논리 삭제된 사원의 사번도 사용 불가(false)
 */
public record EmployeeNoCheckResponse(String employeeNo, boolean available) {
}
