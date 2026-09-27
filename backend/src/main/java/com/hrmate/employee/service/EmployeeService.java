package com.hrmate.employee.service;

import com.hrmate.employee.domain.Employee;
import com.hrmate.employee.dto.EmployeeCreateRequest;
import com.hrmate.employee.dto.EmployeeNoCheckResponse;
import com.hrmate.employee.dto.EmployeeResponse;
import com.hrmate.employee.dto.EmployeeUpdateRequest;
import com.hrmate.employee.repository.EmployeeRepository;
import com.hrmate.global.error.BusinessException;
import com.hrmate.global.error.ErrorCode;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 사원 업무 처리
 *
 * - 삭제된 사원은 조회·수정·삭제 대상에서 제외한다(404).
 * - 사번 중복 확인은 삭제된 사원까지 포함하고, 대문자로 바꾼 값으로 판단한다.
 * - 엔티티 규칙 위반(IllegalArgumentException)은 이 클래스 안에서만 입력 오류(400)로 바꾼다.
 */
@Service
@Transactional(readOnly = true)
public class EmployeeService {

    private static final String EMPLOYEE_NO_UNIQUE_CONSTRAINT = "uk_employee_employee_no";

    private final EmployeeRepository employeeRepository;

    public EmployeeService(EmployeeRepository employeeRepository) {
        this.employeeRepository = employeeRepository;
    }

    public List<EmployeeResponse> getEmployees() {
        return employeeRepository.findAllByDeletedAtIsNullOrderByEmployeeNoAsc().stream()
                .map(EmployeeResponse::from)
                .toList();
    }

    public EmployeeResponse getEmployee(Long id) {
        return EmployeeResponse.from(findActiveEmployee(id));
    }

    public EmployeeNoCheckResponse checkEmployeeNo(String value) {
        String employeeNo = normalizeEmployeeNo(value, "value");
        return new EmployeeNoCheckResponse(employeeNo, !employeeRepository.existsByEmployeeNo(employeeNo));
    }

    @Transactional
    public EmployeeResponse createEmployee(EmployeeCreateRequest request) {
        String employeeNo = normalizeEmployeeNo(request.employeeNo(), "employeeNo");
        if (employeeRepository.existsByEmployeeNo(employeeNo)) {
            throw duplicatedEmployeeNo();
        }

        Employee employee = applyRules(() -> Employee.create(
                employeeNo, request.name(), request.hireDate(),
                request.department(), request.position(), request.phone(), request.email()));

        try {
            return EmployeeResponse.from(employeeRepository.saveAndFlush(employee));
        } catch (DataIntegrityViolationException e) {
            // 중복 확인과 저장 사이에 같은 사번이 먼저 저장된 경우 (DB UNIQUE 제약이 막음)
            if (isEmployeeNoDuplicate(e)) {
                throw duplicatedEmployeeNo();
            }
            throw e;
        }
    }

    @Transactional
    public EmployeeResponse updateEmployee(Long id, EmployeeUpdateRequest request) {
        Employee employee = findActiveEmployee(id);
        applyRules(() -> {
            employee.updateBasicInfo(request.name(), request.department(), request.position(),
                    request.phone(), request.email());
            employee.changeEmployment(request.hireDate(), request.employmentStatus(), request.resignationDate());
            return employee;
        });
        return EmployeeResponse.from(employee);
    }

    /** 논리 삭제: 행은 남기고 삭제 시각만 기록한다. */
    @Transactional
    public void deleteEmployee(Long id) {
        findActiveEmployee(id).delete();
    }

    private Employee findActiveEmployee(Long id) {
        return employeeRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.EMPLOYEE_NOT_FOUND));
    }

    private static String normalizeEmployeeNo(String value, String field) {
        try {
            return Employee.normalizeEmployeeNo(value);
        } catch (IllegalArgumentException e) {
            throw BusinessException.invalidField(field, e.getMessage());
        }
    }

    /** 엔티티 규칙 위반을 입력 오류(400)로 바꾼다. */
    private static Employee applyRules(Supplier<Employee> action) {
        try {
            return action.get();
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, e.getMessage());
        }
    }

    private static boolean isEmployeeNoDuplicate(DataIntegrityViolationException e) {
        String message = NestedExceptionUtils.getMostSpecificCause(e).getMessage();
        return message != null && message.contains(EMPLOYEE_NO_UNIQUE_CONSTRAINT);
    }

    private static BusinessException duplicatedEmployeeNo() {
        return new BusinessException(ErrorCode.EMPLOYEE_NO_DUPLICATED, ErrorCode.EMPLOYEE_NO_DUPLICATED.getDefaultMessage(),
                Map.of("employeeNo", ErrorCode.EMPLOYEE_NO_DUPLICATED.getDefaultMessage()));
    }
}
