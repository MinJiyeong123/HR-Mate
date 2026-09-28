package com.hrmate.payroll.service;

import com.hrmate.employee.domain.Employee;
import com.hrmate.employee.repository.EmployeeRepository;
import com.hrmate.global.error.BusinessException;
import com.hrmate.global.error.ErrorCode;
import com.hrmate.payroll.domain.PayItem;
import com.hrmate.payroll.domain.Payroll;
import com.hrmate.payroll.domain.PayrollLineInput;
import com.hrmate.payroll.domain.PayrollPeriod;
import com.hrmate.payroll.dto.EmployeePayrollResponse;
import com.hrmate.payroll.dto.PayItemResponse;
import com.hrmate.payroll.dto.PayrollCreateRequest;
import com.hrmate.payroll.dto.PayrollDetailResponse;
import com.hrmate.payroll.dto.PayrollLineRequest;
import com.hrmate.payroll.dto.PayrollUpdateRequest;
import com.hrmate.payroll.repository.PayItemRepository;
import com.hrmate.payroll.repository.PayrollPeriodRepository;
import com.hrmate.payroll.repository.PayrollRepository;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 사원별 월 급여 업무 처리 (포트폴리오용 시뮬레이션)
 *
 * - 합계·실지급액은 엔티티가 항목 금액으로 다시 계산한다. 세금·보험료는 계산하지 않는다.
 * - 엔티티의 입력 규칙 위반(IllegalArgumentException)은 이 클래스 안에서만 fieldErrors.lines 오류(400)로 바꾼다.
 */
@Service
@Transactional(readOnly = true)
public class PayrollService {

    private static final String PAYROLL_UNIQUE_CONSTRAINT = "uk_payroll_period_employee";

    private final PayrollRepository payrollRepository;
    private final PayrollPeriodRepository periodRepository;
    private final PayItemRepository payItemRepository;
    private final EmployeeRepository employeeRepository;

    public PayrollService(PayrollRepository payrollRepository, PayrollPeriodRepository periodRepository,
                          PayItemRepository payItemRepository, EmployeeRepository employeeRepository) {
        this.payrollRepository = payrollRepository;
        this.periodRepository = periodRepository;
        this.payItemRepository = payItemRepository;
        this.employeeRepository = employeeRepository;
    }

    public List<PayItemResponse> getPayItems() {
        return payItemRepository.findAllByActiveTrueOrderBySortOrderAsc().stream()
                .map(PayItemResponse::from)
                .toList();
    }

    @Transactional
    public PayrollDetailResponse createPayroll(Long periodId, PayrollCreateRequest request) {
        PayrollPeriod period = periodRepository.findById(periodId)
                .orElseThrow(() -> new BusinessException(ErrorCode.PAYROLL_PERIOD_NOT_FOUND));
        assertEditable(period);

        Employee employee = employeeRepository.findById(request.employeeId())
                .orElseThrow(() -> new BusinessException(ErrorCode.EMPLOYEE_NOT_FOUND));
        if (employee.isDeleted()) {
            throw new BusinessException(ErrorCode.EMPLOYEE_NOT_ELIGIBLE, "삭제된 사원에게는 급여를 입력할 수 없습니다.");
        }
        if (!Payroll.isEligible(employee, period.yearMonth())) {
            throw new BusinessException(ErrorCode.EMPLOYEE_NOT_ELIGIBLE);
        }
        if (payrollRepository.existsByPeriod_IdAndEmployee_Id(periodId, employee.getId())) {
            throw new BusinessException(ErrorCode.PAYROLL_DUPLICATED);
        }

        List<PayrollLineInput> inputs = toInputs(request.lines());
        Payroll payroll = applyRules(() -> Payroll.create(period, employee, inputs, request.memo()));

        try {
            return PayrollDetailResponse.from(payrollRepository.saveAndFlush(payroll));
        } catch (DataIntegrityViolationException e) {
            // 중복 확인과 저장 사이에 같은 사원 급여가 먼저 저장된 경우
            if (PayrollPeriodService.violates(e, PAYROLL_UNIQUE_CONSTRAINT)) {
                throw new BusinessException(ErrorCode.PAYROLL_DUPLICATED);
            }
            throw e;
        }
    }

    public PayrollDetailResponse getPayroll(Long id) {
        return PayrollDetailResponse.from(findPayroll(id));
    }

    @Transactional
    public PayrollDetailResponse updatePayroll(Long id, PayrollUpdateRequest request) {
        Payroll payroll = findPayroll(id);
        assertEditable(payroll.getPeriod());

        List<PayrollLineInput> inputs = toInputs(request.lines());
        applyRules(() -> {
            payroll.changeLines(inputs);
            payroll.changeMemo(request.memo());
            return payroll;
        });
        payrollRepository.flush();
        return PayrollDetailResponse.from(payroll);
    }

    /** 작성 중인 기간의 급여만 실제로 삭제한다. (항목도 함께 삭제) */
    @Transactional
    public void deletePayroll(Long id) {
        Payroll payroll = findPayroll(id);
        assertEditable(payroll.getPeriod());
        payrollRepository.delete(payroll);
    }

    /** 사원별 연간 급여 내역 (월 순). 삭제된 사원은 404, 급여 기록은 그대로 남는다. */
    public List<EmployeePayrollResponse> getEmployeePayrolls(Long employeeId, Integer year) {
        if (year == null || year < PayrollPeriod.MIN_YEAR || year > PayrollPeriod.MAX_YEAR) {
            throw BusinessException.invalidField("year", "연도는 2000~2100 사이로 입력해 주세요.");
        }
        Employee employee = employeeRepository.findByIdAndDeletedAtIsNull(employeeId)
                .orElseThrow(() -> new BusinessException(ErrorCode.EMPLOYEE_NOT_FOUND));
        return payrollRepository.findAllByEmployee_IdAndPeriod_PayYearOrderByPeriod_PayMonthAsc(employee.getId(), year)
                .stream()
                .map(EmployeePayrollResponse::from)
                .toList();
    }

    private Payroll findPayroll(Long id) {
        return payrollRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.PAYROLL_NOT_FOUND));
    }

    private static void assertEditable(PayrollPeriod period) {
        if (period.isConfirmed()) {
            throw new BusinessException(ErrorCode.PAYROLL_PERIOD_CONFIRMED);
        }
    }

    /** 항목 ID를 실제 항목으로 바꾼다. 없는 항목은 fieldErrors.lines 오류(400) */
    private List<PayrollLineInput> toInputs(List<PayrollLineRequest> lines) {
        List<Long> ids = lines.stream().map(PayrollLineRequest::payItemId).distinct().toList();
        Map<Long, PayItem> items = payItemRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(PayItem::getId, Function.identity()));
        return lines.stream()
                .map(line -> {
                    PayItem item = items.get(line.payItemId());
                    if (item == null) {
                        throw BusinessException.invalidField("lines", "존재하지 않는 항목입니다: " + line.payItemId());
                    }
                    return new PayrollLineInput(item, line.amount());
                })
                .toList();
    }

    /** 엔티티의 입력 규칙 위반을 fieldErrors.lines 오류(400)로 바꾼다. */
    private static Payroll applyRules(Supplier<Payroll> action) {
        try {
            return action.get();
        } catch (IllegalArgumentException e) {
            throw BusinessException.invalidField("lines", e.getMessage());
        }
    }
}
