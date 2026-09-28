package com.hrmate.payroll.dto;

import com.hrmate.payroll.domain.PayrollLine;
import com.hrmate.payroll.domain.TaxType;

/** 명세서 항목 한 줄. 항목 이름·과세 구분은 입력 당시 복사해 둔 값이다. */
public record PayrollLineResponse(
        Long payItemId,
        String itemName,
        TaxType taxType,
        long amount
) {

    public static PayrollLineResponse from(PayrollLine line) {
        return new PayrollLineResponse(line.getPayItem().getId(), line.getItemName(), line.getTaxType(), line.getAmount());
    }
}
