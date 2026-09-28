package com.hrmate.payroll.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

/** 급여 기간 지급일 수정 요청 (PUT /api/payroll-periods/{id}). 연월은 바꿀 수 없다. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PayrollPeriodUpdateRequest(

        @NotNull(message = "지급일을 입력해 주세요.")
        LocalDate paymentDate
) {
}
