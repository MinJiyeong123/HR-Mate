package com.hrmate.yearend.dto;

import com.hrmate.yearend.calculator.PersonalDeductionInput;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * 연말정산 입력 자료 저장 요청 (PUT /api/year-end/{year}/employees/{id}/input)
 * 항목별 범위는 여기서, 여러 항목에 걸친 규칙은 PersonalDeductionInput 이 검사한다.
 */
public record YearEndInputRequest(

        @NotNull(message = "배우자 기본공제 여부를 선택해 주세요.")
        Boolean spouseDeduction,

        @NotNull(message = "부양가족 인원을 입력해 주세요.")
        @Min(value = 0, message = "부양가족 인원은 0~20명으로 입력해 주세요.")
        @Max(value = 20, message = "부양가족 인원은 0~20명으로 입력해 주세요.")
        Integer dependentCount,

        @NotNull(message = "경로우대 인원을 입력해 주세요.")
        @Min(value = 0, message = "경로우대 인원은 0명 이상으로 입력해 주세요.")
        @Max(value = 22, message = "경로우대 인원은 기본공제 대상자 수 이하로 입력해 주세요.")
        Integer elderlyCount,

        @NotNull(message = "장애인 인원을 입력해 주세요.")
        @Min(value = 0, message = "장애인 인원은 0명 이상으로 입력해 주세요.")
        @Max(value = 22, message = "장애인 인원은 기본공제 대상자 수 이하로 입력해 주세요.")
        Integer disabledCount,

        @NotNull(message = "부녀자 공제 여부를 선택해 주세요.")
        Boolean womanDeduction,

        @NotNull(message = "한부모 공제 여부를 선택해 주세요.")
        Boolean singleParentDeduction,

        @NotNull(message = "자녀세액공제 대상 자녀 수를 입력해 주세요.")
        @Min(value = 0, message = "자녀세액공제 대상 자녀 수는 0명 이상으로 입력해 주세요.")
        @Max(value = 20, message = "자녀세액공제 대상 자녀 수는 부양가족 인원 이하로 입력해 주세요.")
        Integer childCreditCount,

        @NotNull(message = "출산·입양 첫째 인원을 입력해 주세요.")
        @Min(value = 0, message = "출산·입양 첫째는 0~1명으로 입력해 주세요.")
        @Max(value = 1, message = "출산·입양 첫째는 0~1명으로 입력해 주세요.")
        Integer birthFirstCount,

        @NotNull(message = "출산·입양 둘째 인원을 입력해 주세요.")
        @Min(value = 0, message = "출산·입양 둘째는 0~1명으로 입력해 주세요.")
        @Max(value = 1, message = "출산·입양 둘째는 0~1명으로 입력해 주세요.")
        Integer birthSecondCount,

        @NotNull(message = "출산·입양 셋째 이상 인원을 입력해 주세요.")
        @Min(value = 0, message = "출산·입양 셋째 이상은 0~10명으로 입력해 주세요.")
        @Max(value = 10, message = "출산·입양 셋째 이상은 0~10명으로 입력해 주세요.")
        Integer birthThirdPlusCount
) {

    /** 여러 항목에 걸친 규칙 위반은 IllegalArgumentException */
    public PersonalDeductionInput toPersonalDeductionInput() {
        return new PersonalDeductionInput(spouseDeduction, dependentCount, elderlyCount, disabledCount,
                womanDeduction, singleParentDeduction, childCreditCount, birthFirstCount, birthSecondCount,
                birthThirdPlusCount);
    }
}
