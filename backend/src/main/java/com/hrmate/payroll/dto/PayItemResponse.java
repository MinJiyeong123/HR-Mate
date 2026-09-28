package com.hrmate.payroll.dto;

import com.hrmate.payroll.domain.PayItem;
import com.hrmate.payroll.domain.PayItemCategory;
import com.hrmate.payroll.domain.TaxType;

/** 지급·공제 항목 (GET /api/pay-items) */
public record PayItemResponse(
        Long id,
        String code,
        String name,
        PayItemCategory category,
        TaxType taxType,
        int sortOrder
) {

    public static PayItemResponse from(PayItem item) {
        return new PayItemResponse(item.getId(), item.getCode(), item.getName(), item.getCategory(),
                item.getTaxType(), item.getSortOrder());
    }
}
