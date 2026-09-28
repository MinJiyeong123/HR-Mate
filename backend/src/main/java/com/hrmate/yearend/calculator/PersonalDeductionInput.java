package com.hrmate.yearend.calculator;

/**
 * 연말정산 인적공제·자녀세액공제 입력 (사원·귀속연도별)
 *
 * <p>이름·주민등록번호 등 개인 식별 정보는 받지 않고 인원 수와 해당 여부만 받는다.
 * 공제 요건(나이·소득·동거 등) 판단은 사용자가 한다. 규칙 위반은 IllegalArgumentException.
 * 규칙: docs/requirements-year-end.md 4장
 */
public record PersonalDeductionInput(
        boolean spouseDeduction,
        int dependentCount,
        int elderlyCount,
        int disabledCount,
        boolean womanDeduction,
        boolean singleParentDeduction,
        int childCreditCount,
        int birthFirstCount,
        int birthSecondCount,
        int birthThirdPlusCount
) {

    public static final int MAX_DEPENDENT_COUNT = 20;
    public static final int MAX_BIRTH_THIRD_PLUS_COUNT = 10;

    /** 입력 자료가 없을 때: 본인 기본공제만 */
    public static final PersonalDeductionInput SELF_ONLY =
            new PersonalDeductionInput(false, 0, 0, 0, false, false, 0, 0, 0, 0);

    public PersonalDeductionInput {
        requireRange(dependentCount, 0, MAX_DEPENDENT_COUNT, "부양가족 인원은 0~" + MAX_DEPENDENT_COUNT + "명으로 입력해 주세요.");
        int basicCount = 1 + (spouseDeduction ? 1 : 0) + dependentCount;
        requireRange(elderlyCount, 0, basicCount, "경로우대 인원은 기본공제 대상자 수(" + basicCount + "명) 이하로 입력해 주세요.");
        requireRange(disabledCount, 0, basicCount, "장애인 인원은 기본공제 대상자 수(" + basicCount + "명) 이하로 입력해 주세요.");
        if (spouseDeduction && singleParentDeduction) {
            throw new IllegalArgumentException("배우자 기본공제와 한부모 공제는 함께 선택할 수 없습니다.");
        }
        requireRange(childCreditCount, 0, dependentCount, "자녀세액공제 대상 자녀 수는 부양가족 인원 이하로 입력해 주세요.");
        requireRange(birthFirstCount, 0, 1, "출산·입양 첫째는 0~1명으로 입력해 주세요.");
        requireRange(birthSecondCount, 0, 1, "출산·입양 둘째는 0~1명으로 입력해 주세요.");
        requireRange(birthThirdPlusCount, 0, MAX_BIRTH_THIRD_PLUS_COUNT,
                "출산·입양 셋째 이상은 0~" + MAX_BIRTH_THIRD_PLUS_COUNT + "명으로 입력해 주세요.");
        if (birthFirstCount + birthSecondCount + birthThirdPlusCount > dependentCount) {
            throw new IllegalArgumentException("출산·입양 자녀 수의 합은 부양가족 인원 이하로 입력해 주세요.");
        }
    }

    /** 기본공제 대상자 수 (본인 + 배우자 + 부양가족) */
    public int basicDeductionCount() {
        return 1 + (spouseDeduction ? 1 : 0) + dependentCount;
    }

    private static void requireRange(int value, int min, int max, String message) {
        if (value < min || value > max) {
            throw new IllegalArgumentException(message);
        }
    }
}
