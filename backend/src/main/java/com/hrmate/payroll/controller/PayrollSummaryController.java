package com.hrmate.payroll.controller;

import com.hrmate.payroll.dto.AnnualEmployeePayrollResponse;
import com.hrmate.payroll.dto.AnnualPayrollSummaryResponse;
import com.hrmate.payroll.service.PayrollSummaryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 연간 급여 집계 API (조회 전용, 포트폴리오용 시뮬레이션). 명세: docs/api/payroll-api.md */
@RestController
@RequestMapping("/api/payroll-summaries/annual")
public class PayrollSummaryController {

    private final PayrollSummaryService summaryService;

    public PayrollSummaryController(PayrollSummaryService summaryService) {
        this.summaryService = summaryService;
    }

    @GetMapping
    public AnnualPayrollSummaryResponse getAnnualSummary(@RequestParam Integer year) {
        return summaryService.getAnnualSummary(year);
    }

    @GetMapping("/employees/{employeeId}")
    public AnnualEmployeePayrollResponse getEmployeeAnnual(@PathVariable Long employeeId, @RequestParam Integer year) {
        return summaryService.getEmployeeAnnual(employeeId, year);
    }
}
