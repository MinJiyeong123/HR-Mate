package com.hrmate.payroll.service;

import com.hrmate.employee.repository.EmployeeRepository;
import com.hrmate.global.error.BusinessException;
import com.hrmate.global.error.ErrorCode;
import com.hrmate.payroll.domain.Payroll;
import com.hrmate.payroll.domain.PayrollPeriod;
import com.hrmate.payroll.dto.EligibleEmployeeResponse;
import com.hrmate.payroll.dto.PayrollPeriodCreateRequest;
import com.hrmate.payroll.dto.PayrollPeriodDetailResponse;
import com.hrmate.payroll.dto.PayrollPeriodSummaryResponse;
import com.hrmate.payroll.dto.PayrollPeriodUpdateRequest;
import com.hrmate.payroll.dto.PayrollSummaryResponse;
import com.hrmate.payroll.repository.PayrollPeriodRepository;
import com.hrmate.payroll.repository.PayrollRepository;
import com.hrmate.payroll.repository.PayrollRepository.PeriodTotals;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 급여 기간 업무 처리 (포트폴리오용 시뮬레이션)
 *
 * - 확정된 기간의 변경 요청은 PAYROLL_PERIOD_CONFIRMED(409)
 * - 확정 조건·상태 전환 위반은 INVALID_PAYROLL_PERIOD_STATE(409)
 */
@Service
@Transactional(readOnly = true)
public class PayrollPeriodService {

    private static final String PERIOD_UNIQUE_CONSTRAINT = "uk_payroll_period_year_month";

    private final PayrollPeriodRepository periodRepository;
    private final PayrollRepository payrollRepository;
    private final EmployeeRepository employeeRepository;

    public PayrollPeriodService(PayrollPeriodRepository periodRepository, PayrollRepository payrollRepository,
                                EmployeeRepository employeeRepository) {
        this.periodRepository = periodRepository;
        this.payrollRepository = payrollRepository;
        this.employeeRepository = employeeRepository;
    }

    /** 기간 목록 (최신 연월부터), 인원·합계는 한 번의 집계 조회로 구한다. */
    public List<PayrollPeriodSummaryResponse> getPeriods() {
        Map<Long, PeriodTotals> totals = payrollRepository.summarizeByPeriod().stream()
                .collect(Collectors.toMap(PeriodTotals::getPeriodId, Function.identity()));
        return periodRepository.findAllByOrderByPayYearDescPayMonthDesc().stream()
                .map(period -> PayrollPeriodSummaryResponse.of(period, totals.get(period.getId())))
                .toList();
    }

    public PayrollPeriodDetailResponse getPeriod(Long id) {
        PayrollPeriod period = findPeriod(id);
        List<Payroll> payrolls = payrollRepository.findAllByPeriod_IdOrderByEmployeeNoAsc(id);
        return PayrollPeriodDetailResponse.of(
                PayrollPeriodSummaryResponse.of(period, payrolls),
                payrolls.stream().map(PayrollSummaryResponse::from).toList());
    }

    @Transactional
    public PayrollPeriodSummaryResponse createPeriod(PayrollPeriodCreateRequest request) {
        if (periodRepository.existsByPayYearAndPayMonth(request.year(), request.month())) {
            throw new BusinessException(ErrorCode.PAYROLL_PERIOD_DUPLICATED);
        }
        PayrollPeriod period;
        try {
            period = PayrollPeriod.create(request.year(), request.month(), request.paymentDate());
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, e.getMessage());
        }
        try {
            period = periodRepository.saveAndFlush(period);
        } catch (DataIntegrityViolationException e) {
            // 중복 확인과 저장 사이에 같은 연월 기간이 먼저 저장된 경우
            if (violates(e, PERIOD_UNIQUE_CONSTRAINT)) {
                throw new BusinessException(ErrorCode.PAYROLL_PERIOD_DUPLICATED);
            }
            throw e;
        }
        return PayrollPeriodSummaryResponse.of(period, List.of());
    }

    @Transactional
    public PayrollPeriodSummaryResponse updatePaymentDate(Long id, PayrollPeriodUpdateRequest request) {
        PayrollPeriod period = findEditablePeriod(id);
        period.changePaymentDate(request.paymentDate());
        return summary(period);
    }

    /** 확정: 급여가 1건 이상 있어야 한다. */
    @Transactional
    public PayrollPeriodSummaryResponse confirm(Long id) {
        PayrollPeriod period = findPeriod(id);
        try {
            period.confirm(payrollRepository.countByPeriod_Id(id));
        } catch (IllegalStateException e) {
            throw new BusinessException(ErrorCode.INVALID_PAYROLL_PERIOD_STATE, e.getMessage());
        }
        return summary(period);
    }

    /** 확정 취소 (이력은 기록하지 않음) */
    @Transactional
    public PayrollPeriodSummaryResponse reopen(Long id) {
        PayrollPeriod period = findPeriod(id);
        try {
            period.reopen();
        } catch (IllegalStateException e) {
            throw new BusinessException(ErrorCode.INVALID_PAYROLL_PERIOD_STATE, e.getMessage());
        }
        return summary(period);
    }

    /** 급여를 입력할 수 있는 사원: 삭제 안 됨 + 해당 월 재직 + 이 기간에 아직 급여 없음 (사번 순) */
    public List<EligibleEmployeeResponse> getEligibleEmployees(Long id) {
        PayrollPeriod period = findPeriod(id);
        YearMonth yearMonth = period.yearMonth();
        Set<Long> alreadyPaid = payrollRepository.findAllByPeriod_IdOrderByEmployeeNoAsc(id).stream()
                .map(payroll -> payroll.getEmployee().getId())
                .collect(Collectors.toSet());
        return employeeRepository.findAllByDeletedAtIsNullOrderByEmployeeNoAsc().stream()
                .filter(employee -> Payroll.isEligible(employee, yearMonth))
                .filter(employee -> !alreadyPaid.contains(employee.getId()))
                .map(EligibleEmployeeResponse::from)
                .toList();
    }

    private PayrollPeriodSummaryResponse summary(PayrollPeriod period) {
        return PayrollPeriodSummaryResponse.of(period,
                payrollRepository.findAllByPeriod_IdOrderByEmployeeNoAsc(period.getId()));
    }

    private PayrollPeriod findPeriod(Long id) {
        return periodRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.PAYROLL_PERIOD_NOT_FOUND));
    }

    private PayrollPeriod findEditablePeriod(Long id) {
        PayrollPeriod period = findPeriod(id);
        if (period.isConfirmed()) {
            throw new BusinessException(ErrorCode.PAYROLL_PERIOD_CONFIRMED);
        }
        return period;
    }

    static boolean violates(DataIntegrityViolationException e, String constraintName) {
        String message = NestedExceptionUtils.getMostSpecificCause(e).getMessage();
        return message != null && message.contains(constraintName);
    }
}
