package com.hrmate.yearend.calculator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/** 연말정산 인적공제 입력 검증 (DB 접속 없음) */
class PersonalDeductionInputTest {

    private static PersonalDeductionInput input(boolean spouse, int dependents, int elderly, int disabled,
                                                boolean woman, boolean singleParent, int children,
                                                int first, int second, int thirdPlus) {
        return new PersonalDeductionInput(spouse, dependents, elderly, disabled, woman, singleParent, children,
                first, second, thirdPlus);
    }

    private static void assertRejected(Runnable action, String messagePart) {
        assertThatThrownBy(action::run).isInstanceOf(IllegalArgumentException.class).hasMessageContaining(messagePart);
    }

    @Test
    void 정상_입력과_기본공제_대상자_수() {
        PersonalDeductionInput value = input(true, 3, 2, 1, false, false, 2, 1, 0, 0);

        assertThat(value.basicDeductionCount()).isEqualTo(5); // 본인 + 배우자 + 부양가족 3
        assertThat(PersonalDeductionInput.SELF_ONLY.basicDeductionCount()).isEqualTo(1);
    }

    @Test
    void 부양가족_인원은_0에서_20명() {
        input(false, 20, 0, 0, false, false, 0, 0, 0, 0);
        assertRejected(() -> input(false, 21, 0, 0, false, false, 0, 0, 0, 0), "부양가족 인원");
        assertRejected(() -> input(false, -1, 0, 0, false, false, 0, 0, 0, 0), "부양가족 인원");
    }

    @Test
    void 경로우대와_장애인은_기본공제_대상자_수_이하() {
        input(true, 1, 3, 3, false, false, 0, 0, 0, 0); // 대상자 3명
        assertRejected(() -> input(true, 1, 4, 0, false, false, 0, 0, 0, 0), "경로우대");
        assertRejected(() -> input(false, 0, 0, 2, false, false, 0, 0, 0, 0), "장애인");
    }

    @Test
    void 배우자_기본공제와_한부모는_함께_선택할_수_없다() {
        assertRejected(() -> input(true, 1, 0, 0, false, true, 0, 0, 0, 0), "한부모");
        input(false, 1, 0, 0, true, true, 0, 0, 0, 0); // 부녀자 + 한부모 선택은 허용(계산에서 한부모만)
    }

    @Test
    void 자녀세액공제_대상은_부양가족_인원_이하() {
        input(false, 2, 0, 0, false, false, 2, 0, 0, 0);
        assertRejected(() -> input(false, 2, 0, 0, false, false, 3, 0, 0, 0), "자녀세액공제");
    }

    @Test
    void 출산_입양_인원_범위와_합계() {
        input(false, 3, 0, 0, false, false, 0, 1, 1, 1);
        assertRejected(() -> input(false, 3, 0, 0, false, false, 0, 2, 0, 0), "첫째");
        assertRejected(() -> input(false, 3, 0, 0, false, false, 0, 0, 2, 0), "둘째");
        assertRejected(() -> input(false, 20, 0, 0, false, false, 0, 0, 0, 11), "셋째 이상");
        assertRejected(() -> input(false, 1, 0, 0, false, false, 0, 1, 1, 0), "출산·입양 자녀 수의 합");
    }
}
