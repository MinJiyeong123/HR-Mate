package com.hrmate.payroll.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 급여 수정 요청 (PUT /api/payrolls/{id}) - 항목 전체와 메모
 * 사원은 바꿀 수 없다. 본문에 employeeId 등 정의되지 않은 항목이 있으면 무시한다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PayrollUpdateRequest(

        @NotEmpty(message = "급여 항목을 입력해 주세요.")
        @Size(max = 20, message = "급여 항목은 20개 이하로 입력해 주세요.")
        List<@Valid @NotNull(message = "급여 항목을 입력해 주세요.") PayrollLineRequest> lines,

        @Size(max = 200, message = "메모는 200자 이하로 입력해 주세요.")
        String memo
) {
}
