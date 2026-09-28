package com.hrmate.payroll.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.time.YearMonth;
import org.junit.jupiter.api.Test;

/** PayrollPeriod 규칙 단위 테스트 (DB 없이 실행) */
class PayrollPeriodTest {

    private static final LocalDate PAYMENT_DATE = LocalDate.of(2026, 4, 25);

    @Test
    void 생성하면_작성_중_상태로_시작한다() {
        PayrollPeriod period = PayrollPeriod.create(2026, 4, PAYMENT_DATE);

        assertThat(period.getStatus()).isEqualTo(PayrollPeriodStatus.DRAFT);
        assertThat(period.yearMonth()).isEqualTo(YearMonth.of(2026, 4));
        assertThat(period.getPaymentDate()).isEqualTo(PAYMENT_DATE);
        assertThat(period.getConfirmedAt()).isNull();
    }

    @Test
    void 연월과_지급일을_검증한다() {
        assertThatThrownBy(() -> PayrollPeriod.create(1999, 12, PAYMENT_DATE)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PayrollPeriod.create(2101, 1, PAYMENT_DATE)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PayrollPeriod.create(2026, 0, PAYMENT_DATE)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PayrollPeriod.create(2026, 13, PAYMENT_DATE)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PayrollPeriod.create(2026, 4, null)).isInstanceOf(IllegalArgumentException.class);
        assertThat(PayrollPeriod.create(2000, 1, PAYMENT_DATE).yearMonth()).isEqualTo(YearMonth.of(2000, 1));
        assertThat(PayrollPeriod.create(2100, 12, PAYMENT_DATE).yearMonth()).isEqualTo(YearMonth.of(2100, 12));
    }

    @Test
    void 급여가_없으면_확정할_수_없다() {
        PayrollPeriod period = PayrollPeriod.create(2026, 4, PAYMENT_DATE);

        assertThatThrownBy(() -> period.confirm(0))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("1건 이상");
        assertThat(period.isConfirmed()).isFalse();
    }

    @Test
    void 확정과_확정_취소를_할_수_있다() {
        PayrollPeriod period = PayrollPeriod.create(2026, 4, PAYMENT_DATE);

        period.confirm(1);
        assertThat(period.getStatus()).isEqualTo(PayrollPeriodStatus.CONFIRMED);
        assertThat(period.getConfirmedAt()).isNotNull();
        assertThatThrownBy(() -> period.confirm(1)).isInstanceOf(IllegalStateException.class);

        period.reopen();
        assertThat(period.getStatus()).isEqualTo(PayrollPeriodStatus.DRAFT);
        assertThat(period.getConfirmedAt()).isNull();
        assertThatThrownBy(period::reopen).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void 확정된_기간은_지급일을_바꿀_수_없다() {
        PayrollPeriod period = PayrollPeriod.create(2026, 4, PAYMENT_DATE);
        period.changePaymentDate(PAYMENT_DATE.plusDays(1));
        assertThat(period.getPaymentDate()).isEqualTo(PAYMENT_DATE.plusDays(1));

        period.confirm(3);

        assertThatThrownBy(() -> period.changePaymentDate(PAYMENT_DATE)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(period::assertEditable).isInstanceOf(IllegalStateException.class);
    }
}
