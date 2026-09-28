package com.hrmate.payroll.controller;

import com.hrmate.payroll.dto.PayItemResponse;
import com.hrmate.payroll.service.PayrollService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 지급·공제 항목 API. 명세: docs/api/payroll-api.md */
@RestController
@RequestMapping("/api/pay-items")
public class PayItemController {

    private final PayrollService payrollService;

    public PayItemController(PayrollService payrollService) {
        this.payrollService = payrollService;
    }

    @GetMapping
    public List<PayItemResponse> getPayItems() {
        return payrollService.getPayItems();
    }
}
