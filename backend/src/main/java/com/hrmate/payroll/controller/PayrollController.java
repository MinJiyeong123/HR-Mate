package com.hrmate.payroll.controller;

import com.hrmate.payroll.dto.EmployeePayrollResponse;
import com.hrmate.payroll.dto.PayrollDetailResponse;
import com.hrmate.payroll.dto.PayrollUpdateRequest;
import com.hrmate.payroll.service.PayrollService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 급여명세서·사원별 급여 내역 API. 명세: docs/api/payroll-api.md */
@RestController
@RequestMapping("/api")
public class PayrollController {

    private final PayrollService payrollService;

    public PayrollController(PayrollService payrollService) {
        this.payrollService = payrollService;
    }

    @GetMapping("/payrolls/{id}")
    public PayrollDetailResponse getPayroll(@PathVariable Long id) {
        return payrollService.getPayroll(id);
    }

    @PutMapping("/payrolls/{id}")
    public PayrollDetailResponse updatePayroll(@PathVariable Long id, @Valid @RequestBody PayrollUpdateRequest request) {
        return payrollService.updatePayroll(id, request);
    }

    /** 작성 중인 급여만 삭제 */
    @DeleteMapping("/payrolls/{id}")
    public ResponseEntity<Void> deletePayroll(@PathVariable Long id) {
        payrollService.deletePayroll(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/employees/{employeeId}/payrolls")
    public List<EmployeePayrollResponse> getEmployeePayrolls(@PathVariable Long employeeId, @RequestParam Integer year) {
        return payrollService.getEmployeePayrolls(employeeId, year);
    }
}
