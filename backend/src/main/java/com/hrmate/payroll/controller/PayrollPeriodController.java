package com.hrmate.payroll.controller;

import com.hrmate.payroll.dto.EligibleEmployeeResponse;
import com.hrmate.payroll.dto.PayrollCreateRequest;
import com.hrmate.payroll.dto.PayrollDetailResponse;
import com.hrmate.payroll.dto.PayrollPeriodCreateRequest;
import com.hrmate.payroll.dto.PayrollPeriodDetailResponse;
import com.hrmate.payroll.dto.PayrollPeriodSummaryResponse;
import com.hrmate.payroll.dto.PayrollPeriodUpdateRequest;
import com.hrmate.payroll.service.PayrollPeriodService;
import com.hrmate.payroll.service.PayrollService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 급여 기간 API. 명세: docs/api/payroll-api.md */
@RestController
@RequestMapping("/api/payroll-periods")
public class PayrollPeriodController {

    private final PayrollPeriodService periodService;
    private final PayrollService payrollService;

    public PayrollPeriodController(PayrollPeriodService periodService, PayrollService payrollService) {
        this.periodService = periodService;
        this.payrollService = payrollService;
    }

    @GetMapping
    public List<PayrollPeriodSummaryResponse> getPeriods() {
        return periodService.getPeriods();
    }

    @PostMapping
    public ResponseEntity<PayrollPeriodSummaryResponse> createPeriod(@Valid @RequestBody PayrollPeriodCreateRequest request) {
        PayrollPeriodSummaryResponse created = periodService.createPeriod(request);
        return ResponseEntity.created(URI.create("/api/payroll-periods/" + created.id())).body(created);
    }

    @GetMapping("/{id}")
    public PayrollPeriodDetailResponse getPeriod(@PathVariable Long id) {
        return periodService.getPeriod(id);
    }

    @PutMapping("/{id}")
    public PayrollPeriodSummaryResponse updatePeriod(@PathVariable Long id,
                                                     @Valid @RequestBody PayrollPeriodUpdateRequest request) {
        return periodService.updatePaymentDate(id, request);
    }

    @PostMapping("/{id}/confirm")
    public PayrollPeriodSummaryResponse confirm(@PathVariable Long id) {
        return periodService.confirm(id);
    }

    @PostMapping("/{id}/reopen")
    public PayrollPeriodSummaryResponse reopen(@PathVariable Long id) {
        return periodService.reopen(id);
    }

    @GetMapping("/{id}/eligible-employees")
    public List<EligibleEmployeeResponse> getEligibleEmployees(@PathVariable Long id) {
        return periodService.getEligibleEmployees(id);
    }

    @PostMapping("/{id}/payrolls")
    public ResponseEntity<PayrollDetailResponse> createPayroll(@PathVariable Long id,
                                                               @Valid @RequestBody PayrollCreateRequest request) {
        PayrollDetailResponse created = payrollService.createPayroll(id, request);
        return ResponseEntity.created(URI.create("/api/payrolls/" + created.id())).body(created);
    }
}
