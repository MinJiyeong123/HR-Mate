package com.hrmate.payroll.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 급여 입력 요청 (POST /api/payroll-periods/{id}/payrolls)
 * 합계는 서버가 항목 금액으로 계산한다. 세금·보험료는 공제 항목 금액으로 직접 입력한다.
 */
public record PayrollCreateRequest(

        @NotNull(message = "사원을 선택해 주세요.")
        Long employeeId,

        @NotEmpty(message = "급여 항목을 입력해 주세요.")
        @Size(max = 20, message = "급여 항목은 20개 이하로 입력해 주세요.")
        List<@Valid @NotNull(message = "급여 항목을 입력해 주세요.") PayrollLineRequest> lines,

        @Size(max = 200, message = "메모는 200자 이하로 입력해 주세요.")
        String memo
) {
}
