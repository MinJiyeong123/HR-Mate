package com.hrmate.payroll.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/** 급여 항목 입력 (항목 ID + 금액). 금액 0 인 항목은 저장하지 않는다. */
public record PayrollLineRequest(

        @NotNull(message = "항목을 선택해 주세요.")
        Long payItemId,

        @NotNull(message = "금액을 입력해 주세요.")
        @Min(value = 0, message = "금액은 0원 이상으로 입력해 주세요.")
        @Max(value = 1_000_000_000L, message = "항목 금액은 1,000,000,000원 이하로 입력해 주세요.")
        Long amount
) {
}
