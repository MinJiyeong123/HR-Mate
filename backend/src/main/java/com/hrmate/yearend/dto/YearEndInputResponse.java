package com.hrmate.yearend.dto;

import com.hrmate.employee.domain.Employee;
import com.hrmate.yearend.calculator.ChildCreditAgeGuide;
import com.hrmate.yearend.calculator.PersonalDeductionInput;
import com.hrmate.yearend.domain.YearEndInput;
import java.time.LocalDateTime;

/**
 * 연말정산 입력 자료 (GET·PUT /api/year-end/{year}/employees/{id}/input)
 * 저장된 자료가 없으면 saved=false 와 기본값(본인 기본공제만)을 돌려준다. 삭제된 사원은 editable=false.
 * childCreditMinimumAge·childCreditAgeBasis·childCreditAgeCaution 은 귀속연도별 자녀 연령 기준 안내(계산에는 쓰지 않음)다.
 */
public record YearEndInputResponse(
        int year,
        Long employeeId,
        boolean saved,
        boolean editable,
        boolean spouseDeduction,
        int dependentCount,
        int elderlyCount,
        int disabledCount,
        boolean womanDeduction,
        boolean singleParentDeduction,
        int childCreditCount,
        int birthFirstCount,
        int birthSecondCount,
        int birthThirdPlusCount,
        LocalDateTime updatedAt,
        Integer childCreditMinimumAge,
        String childCreditAgeBasis,
        String childCreditAgeCaution
) {

    /** input 이 null 이면 저장된 자료 없음 */
    public static YearEndInputResponse of(int year, Employee employee, YearEndInput input) {
        PersonalDeductionInput values = input == null ? PersonalDeductionInput.SELF_ONLY : input.toPersonalDeductionInput();
        ChildCreditAgeGuide guide = ChildCreditAgeGuide.forYear(year);
        return new YearEndInputResponse(year, employee.getId(), input != null, !employee.isDeleted(),
                values.spouseDeduction(), values.dependentCount(), values.elderlyCount(), values.disabledCount(),
                values.womanDeduction(), values.singleParentDeduction(), values.childCreditCount(),
                values.birthFirstCount(), values.birthSecondCount(), values.birthThirdPlusCount(),
                input == null ? null : input.getUpdatedAt(),
                guide.minimumAge(), guide.basis(), guide.caution());
    }
}
