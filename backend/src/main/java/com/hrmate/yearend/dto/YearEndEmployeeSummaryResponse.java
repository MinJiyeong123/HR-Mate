package com.hrmate.yearend.dto;

/**
 * 연말정산 목록 한 줄 (GET /api/year-end/{year}/employees) - 모의 계산
 * 사원 정보는 그 해 마지막 확정 급여의 스냅샷이다. balance: 양수 추가 납부, 음수 환급.
 * rulesYear: 실제로 적용한 계산 규칙의 귀속연도(등록되지 않은 연도는 2025).
 */
public record YearEndEmployeeSummaryResponse(
        Long employeeId,
        String employeeNo,
        String employeeName,
        String department,
        String position,
        boolean deleted,
        boolean resigned,
        boolean inputSaved,
        int payrollCount,
        long totalSalary,
        long determinedTax,
        long prepaidTax,
        long balance,
        int rulesYear
) {
}
