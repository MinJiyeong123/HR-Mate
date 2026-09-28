package com.hrmate.yearend.controller;

import com.hrmate.yearend.dto.YearEndEmployeeSummaryResponse;
import com.hrmate.yearend.dto.YearEndInputRequest;
import com.hrmate.yearend.dto.YearEndInputResponse;
import com.hrmate.yearend.dto.YearEndResultResponse;
import com.hrmate.yearend.service.YearEndService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 연말정산 모의 계산 API (포트폴리오용, 전문가 검증 전). 명세: docs/api/year-end-api.md */
@RestController
@RequestMapping("/api/year-end/{year}/employees")
public class YearEndController {

    private final YearEndService yearEndService;

    public YearEndController(YearEndService yearEndService) {
        this.yearEndService = yearEndService;
    }

    @GetMapping
    public List<YearEndEmployeeSummaryResponse> getEmployees(@PathVariable Integer year) {
        return yearEndService.getEmployees(year);
    }

    @GetMapping("/{employeeId}/input")
    public YearEndInputResponse getInput(@PathVariable Integer year, @PathVariable Long employeeId) {
        return yearEndService.getInput(employeeId, year);
    }

    @PutMapping("/{employeeId}/input")
    public YearEndInputResponse saveInput(@PathVariable Integer year, @PathVariable Long employeeId,
                                          @Valid @RequestBody YearEndInputRequest request) {
        return yearEndService.saveInput(employeeId, year, request);
    }

    @GetMapping("/{employeeId}/result")
    public YearEndResultResponse getResult(@PathVariable Integer year, @PathVariable Long employeeId) {
        return yearEndService.getResult(employeeId, year);
    }
}
