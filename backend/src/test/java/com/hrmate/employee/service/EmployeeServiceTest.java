package com.hrmate.employee.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hrmate.employee.domain.Employee;
import com.hrmate.employee.domain.EmploymentStatus;
import com.hrmate.employee.dto.EmployeeCreateRequest;
import com.hrmate.employee.dto.EmployeeNoCheckResponse;
import com.hrmate.employee.dto.EmployeeResponse;
import com.hrmate.employee.dto.EmployeeUpdateRequest;
import com.hrmate.employee.repository.EmployeeRepository;
import com.hrmate.global.error.BusinessException;
import com.hrmate.global.error.ErrorCode;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

/** EmployeeService 단위 테스트 (가짜 리포지토리 사용, DB 접속 없음) */
@ExtendWith(MockitoExtension.class)
class EmployeeServiceTest {

    private static final LocalDate HIRE_DATE = LocalDate.of(2026, 3, 2);

    @Mock
    private EmployeeRepository employeeRepository;

    @InjectMocks
    private EmployeeService employeeService;

    private static EmployeeCreateRequest createRequest(String employeeNo) {
        return new EmployeeCreateRequest(employeeNo, "김가상", HIRE_DATE, "인사팀", "대리", "010-0000-0001", "kim@example.com");
    }

    private static EmployeeUpdateRequest updateRequest(EmploymentStatus status, LocalDate resignationDate) {
        return new EmployeeUpdateRequest("김가상", HIRE_DATE, "재무팀", "과장", null, "kim@example.com", status, resignationDate);
    }

    private static Employee employee() {
        return Employee.create("E2026001", "김가상", HIRE_DATE, "인사팀", "대리", null, null);
    }

    private static void assertErrorCode(Runnable action, ErrorCode expected) {
        assertThatThrownBy(action::run)
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(expected);
    }

    @Test
    void 등록하면_사번을_대문자로_바꿔_저장한다() {
        when(employeeRepository.existsByEmployeeNo("E2026001")).thenReturn(false);
        when(employeeRepository.saveAndFlush(any(Employee.class))).thenAnswer(invocation -> invocation.getArgument(0));

        EmployeeResponse response = employeeService.createEmployee(createRequest("e2026001"));

        assertThat(response.employeeNo()).isEqualTo("E2026001");
        assertThat(response.employmentStatus()).isEqualTo(EmploymentStatus.ACTIVE);
        assertThat(response.resignationDate()).isNull();
    }

    @Test
    void 이미_사용된_사번이면_409_오류로_거부한다() {
        when(employeeRepository.existsByEmployeeNo("E2026001")).thenReturn(true);

        assertErrorCode(() -> employeeService.createEmployee(createRequest("e2026001")), ErrorCode.EMPLOYEE_NO_DUPLICATED);
        verify(employeeRepository, never()).saveAndFlush(any());
    }

    @Test
    void 동시에_등록되어_DB_중복_제약에_걸리면_409_오류로_바꾼다() {
        when(employeeRepository.existsByEmployeeNo("E2026001")).thenReturn(false);
        when(employeeRepository.saveAndFlush(any(Employee.class)))
                .thenThrow(new DataIntegrityViolationException("Duplicate entry 'E2026001' for key 'uk_employee_employee_no'"));

        assertErrorCode(() -> employeeService.createEmployee(createRequest("E2026001")), ErrorCode.EMPLOYEE_NO_DUPLICATED);
    }

    @Test
    void 사번_중복이_아닌_DB_오류는_그대로_전달한다() {
        when(employeeRepository.existsByEmployeeNo("E2026001")).thenReturn(false);
        when(employeeRepository.saveAndFlush(any(Employee.class)))
                .thenThrow(new DataIntegrityViolationException("CONSTRAINT `ck_employee_resignation_date` failed"));

        assertThatThrownBy(() -> employeeService.createEmployee(createRequest("E2026001")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void 사번_형식_오류는_해당_항목의_400_오류로_보고한다() {
        assertThatThrownBy(() -> employeeService.checkEmployeeNo("E 001"))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> {
                    BusinessException be = (BusinessException) e;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT);
                    assertThat(be.getFieldErrors())
                            .containsEntry("value", "사번은 공백 없이 영문·숫자 20자 이내로 입력해 주세요.");
                });
    }

    @Test
    void 사번_중복_확인은_대문자로_바꾼_값으로_판단한다() {
        when(employeeRepository.existsByEmployeeNo("E2026001")).thenReturn(true);

        EmployeeNoCheckResponse response = employeeService.checkEmployeeNo("e2026001");

        assertThat(response.employeeNo()).isEqualTo("E2026001");
        assertThat(response.available()).isFalse();
    }

    @Test
    void 없거나_삭제된_사원은_404_오류다() {
        when(employeeRepository.findByIdAndDeletedAtIsNull(99L)).thenReturn(Optional.empty());

        assertErrorCode(() -> employeeService.getEmployee(99L), ErrorCode.EMPLOYEE_NOT_FOUND);
        assertErrorCode(() -> employeeService.updateEmployee(99L, updateRequest(EmploymentStatus.ACTIVE, null)),
                ErrorCode.EMPLOYEE_NOT_FOUND);
        assertErrorCode(() -> employeeService.deleteEmployee(99L), ErrorCode.EMPLOYEE_NOT_FOUND);
    }

    @Test
    void 수정해도_사번은_바뀌지_않는다() {
        Employee employee = employee();
        when(employeeRepository.findByIdAndDeletedAtIsNull(1L)).thenReturn(Optional.of(employee));

        EmployeeResponse response = employeeService.updateEmployee(1L,
                updateRequest(EmploymentStatus.RESIGNED, HIRE_DATE.plusMonths(6)));

        assertThat(response.employeeNo()).isEqualTo("E2026001");
        assertThat(response.department()).isEqualTo("재무팀");
        assertThat(response.employmentStatus()).isEqualTo(EmploymentStatus.RESIGNED);
    }

    @Test
    void 엔티티_규칙_위반은_400_오류로_바꾼다() {
        when(employeeRepository.findByIdAndDeletedAtIsNull(1L)).thenReturn(Optional.of(employee()));

        assertErrorCode(() -> employeeService.updateEmployee(1L,
                updateRequest(EmploymentStatus.RESIGNED, HIRE_DATE.minusDays(1))), ErrorCode.INVALID_INPUT);
    }

    @Test
    void 삭제하면_삭제_시각만_기록한다() {
        Employee employee = employee();
        when(employeeRepository.findByIdAndDeletedAtIsNull(1L)).thenReturn(Optional.of(employee));

        employeeService.deleteEmployee(1L);

        assertThat(employee.isDeleted()).isTrue();
        verify(employeeRepository, never()).delete(any());
        verify(employeeRepository, never()).deleteById(any());
    }
}
