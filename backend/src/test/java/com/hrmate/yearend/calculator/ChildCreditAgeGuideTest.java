package com.hrmate.yearend.calculator;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * 자녀세액공제 연령 기준 안내 (DB 접속 없음)
 * 근거: 소득세법 부칙(법률 제21548호) 제2조, 제59조의2① — docs/tax-rules/year-end-settlement-2026.md
 */
class ChildCreditAgeGuideTest {

    @Test
    void 연도_2024_이하는_확인하지_않음() {
        ChildCreditAgeGuide guide = ChildCreditAgeGuide.forYear(2024);

        assertThat(guide.minimumAge()).isNull();
        assertThat(guide.basis()).startsWith("이 연도의 나이 기준은 확인하지 않았습니다.").contains("2025년 귀속 규칙으로 대체");
        assertThat(guide.caution()).isNull();
    }

    @Test
    void 연도_2025는_8세_이상_주의_없음() {
        ChildCreditAgeGuide guide = ChildCreditAgeGuide.forYear(2025);

        assertThat(guide.minimumAge()).isEqualTo(8);
        assertThat(guide.basis()).contains("2025년 귀속").contains("개정 전");
        assertThat(guide.caution()).isNull();
    }

    @Test
    void 연도_2026은_9세_이상_부칙_기준_2017년생_주의() {
        ChildCreditAgeGuide guide = ChildCreditAgeGuide.forYear(2026);

        assertThat(guide.minimumAge()).isEqualTo(9);
        assertThat(guide.basis()).contains("부칙(법률 제21548호) 제2조②").contains("국세청 안내 미확인").doesNotContain("참고");
        // 법령 사실과 해석(가능성)을 나눠 표시하고, 확정 표현을 쓰지 않는다.
        assertThat(guide.caution()).contains("[법령]").contains("제2조③").contains("[해석]")
                .contains("공제 대상이 아닐 수 있습니다").contains("해석 미확정").contains("전문가 확인이 필요합니다")
                .contains("2026년 귀속");
    }

    @ParameterizedTest(name = "{0}년 → {1}세 이상(참고)")
    @CsvSource({"2027, 10", "2028, 11", "2029, 12"})
    void 연도_2027_2029는_부칙_연령을_참고로_표시하고_계산_대체를_알림(int year, int age) {
        ChildCreditAgeGuide guide = ChildCreditAgeGuide.forYear(year);

        assertThat(guide.minimumAge()).isEqualTo(age);
        assertThat(guide.basis()).startsWith("참고:").contains("부칙(법률 제21548호) 제2조②")
                .contains("계산은 2025년 귀속 규칙으로 대체");
        assertThat(guide.caution()).contains(year + "년 귀속").contains("해석 미확정");
    }

    @ParameterizedTest(name = "{0}년 → 13세 이상(참고)")
    @CsvSource({"2030", "2099"})
    void 연도_2030_이후는_본문_13세를_참고로_표시하고_주의_없음(int year) {
        ChildCreditAgeGuide guide = ChildCreditAgeGuide.forYear(year);

        assertThat(guide.minimumAge()).isEqualTo(13);
        assertThat(guide.basis()).startsWith("참고:").contains("제59조의2①").contains("계산은 2025년 귀속 규칙으로 대체");
        assertThat(guide.caution()).isNull();
    }
}
