package com.hrmate.payroll.domain;

/**
 * 급여 항목 입력값 (항목 + 금액). amount 가 null 이면 0원으로 본다.
 */
public record PayrollLineInput(PayItem payItem, Long amount) {
}
