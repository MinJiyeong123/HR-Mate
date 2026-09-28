package com.hrmate.payroll.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

/** 급여 기간 생성 요청 (POST /api/payroll-periods) */
public record PayrollPeriodCreateRequest(

        @NotNull(message = "연도를 입력해 주세요.")
        @Min(value = 2000, message = "연도는 2000~2100 사이로 입력해 주세요.")
        @Max(value = 2100, message = "연도는 2000~2100 사이로 입력해 주세요.")
        Integer year,

        @NotNull(message = "월을 입력해 주세요.")
        @Min(value = 1, message = "월은 1~12 사이로 입력해 주세요.")
        @Max(value = 12, message = "월은 1~12 사이로 입력해 주세요.")
        Integer month,

        @NotNull(message = "지급일을 입력해 주세요.")
        LocalDate paymentDate
) {
}
