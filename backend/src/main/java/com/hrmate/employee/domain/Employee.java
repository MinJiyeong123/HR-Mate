package com.hrmate.employee.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.regex.Pattern;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 사원 기본 정보 (테이블: employee, 마이그레이션: V1__create_employee.sql)
 *
 * <ul>
 *   <li>id: 내부 식별자. 이후 급여·연말정산 기록은 이 값을 참조한다.</li>
 *   <li>사번은 대문자로 통일해서 저장하고, 등록 후 바꿀 수 없다(setter 없음, updatable = false).</li>
 *   <li>삭제는 논리 삭제(deletedAt 기록)만 한다. 삭제된 사원의 사번도 계속 사용 중으로 취급한다.</li>
 * </ul>
 *
 * 규칙 위반 시 IllegalArgumentException / IllegalStateException 을 던진다.
 * API 오류 응답으로의 변환은 4단계(서비스·예외 처리)에서 담당한다.
 */
@Entity
@Table(name = "employee")
public class Employee {

    public static final int EMPLOYEE_NO_MAX_LENGTH = 20;
    /** 사번 형식 오류 문구. 등록 요청 검증(ValidationPatterns)도 이 문구를 사용한다. */
    public static final String EMPLOYEE_NO_FORMAT_MESSAGE =
            "사번은 공백 없이 영문·숫자 " + EMPLOYEE_NO_MAX_LENGTH + "자 이내로 입력해 주세요.";
    private static final Pattern EMPLOYEE_NO_PATTERN = Pattern.compile("^[A-Z0-9]{1," + EMPLOYEE_NO_MAX_LENGTH + "}$");

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "employee_no", nullable = false, length = EMPLOYEE_NO_MAX_LENGTH, updatable = false)
    private String employeeNo;

    @Column(name = "name", nullable = false, length = 50)
    private String name;

    @Column(name = "department", length = 100)
    private String department;

    @Column(name = "position", length = 50)
    private String position;

    @Column(name = "phone", length = 20)
    private String phone;

    @Column(name = "email", length = 100)
    private String email;

    @Column(name = "hire_date", nullable = false)
    private LocalDate hireDate;

    // MariaDB 전용 ENUM 타입이 아닌 VARCHAR 컬럼에 저장한다.
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "employment_status", nullable = false, length = 20)
    private EmploymentStatus employmentStatus;

    @Column(name = "resignation_date")
    private LocalDate resignationDate;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /** JPA 전용 기본 생성자 */
    protected Employee() {
    }

    private Employee(String employeeNo, String name, LocalDate hireDate) {
        this.employeeNo = employeeNo;
        this.name = name;
        this.hireDate = hireDate;
        this.employmentStatus = EmploymentStatus.ACTIVE;
    }

    /** 신규 사원 생성. 재직 상태로 시작한다. */
    public static Employee create(String employeeNo, String name, LocalDate hireDate,
                                  String department, String position, String phone, String email) {
        String normalizedEmployeeNo = normalizeEmployeeNo(employeeNo);
        requireText(name, "이름");
        requireNonNull(hireDate, "입사일");

        Employee employee = new Employee(normalizedEmployeeNo, name.trim(), hireDate);
        employee.department = trimToNull(department);
        employee.position = trimToNull(position);
        employee.phone = trimToNull(phone);
        employee.email = trimToNull(email);
        return employee;
    }

    /** 사번을 저장 형식(대문자)으로 바꾸고 형식을 검사한다. */
    public static String normalizeEmployeeNo(String employeeNo) {
        requireNonNull(employeeNo, "사번");
        String normalized = employeeNo.toUpperCase(Locale.ROOT);
        if (!EMPLOYEE_NO_PATTERN.matcher(normalized).matches()) {
            throw new IllegalArgumentException(EMPLOYEE_NO_FORMAT_MESSAGE);
        }
        return normalized;
    }

    /** 이름·소속·연락처 수정 (사번은 수정 불가) */
    public void updateBasicInfo(String name, String department, String position, String phone, String email) {
        assertNotDeleted();
        requireText(name, "이름");
        this.name = name.trim();
        this.department = trimToNull(department);
        this.position = trimToNull(position);
        this.phone = trimToNull(phone);
        this.email = trimToNull(email);
    }

    /**
     * 입사일·재직 상태·퇴사일 변경. 재직 상태는 이 메서드에서만 바뀐다.
     * (추후 상태 변경 이력을 남길 때 이 메서드에 기록 로직을 추가한다.)
     *
     * <ul>
     *   <li>재직: 퇴사일이 비어 있어야 한다. (퇴사 → 재직 정정 시 퇴사일을 비워서 요청)</li>
     *   <li>퇴사: 퇴사일 필수, 입사일보다 빠를 수 없다.</li>
     * </ul>
     */
    public void changeEmployment(LocalDate hireDate, EmploymentStatus status, LocalDate resignationDate) {
        assertNotDeleted();
        requireNonNull(hireDate, "입사일");
        requireNonNull(status, "재직 상태");

        if (status == EmploymentStatus.ACTIVE && resignationDate != null) {
            throw new IllegalArgumentException("재직 상태에서는 퇴사일을 비워야 합니다.");
        }
        if (status == EmploymentStatus.RESIGNED) {
            if (resignationDate == null) {
                throw new IllegalArgumentException("퇴사 상태에서는 퇴사일을 입력해야 합니다.");
            }
            if (resignationDate.isBefore(hireDate)) {
                throw new IllegalArgumentException("퇴사일은 입사일보다 빠를 수 없습니다.");
            }
        }

        this.hireDate = hireDate;
        this.employmentStatus = status;
        this.resignationDate = resignationDate;
    }

    /** 논리 삭제. 행은 그대로 두고 삭제 시각만 기록한다. */
    public void delete() {
        assertNotDeleted();
        this.deletedAt = LocalDateTime.now();
    }

    public boolean isDeleted() {
        return deletedAt != null;
    }

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    private void assertNotDeleted() {
        if (isDeleted()) {
            throw new IllegalStateException("삭제된 사원은 변경할 수 없습니다.");
        }
    }

    private static void requireNonNull(Object value, String fieldName) {
        if (value == null) {
            throw new IllegalArgumentException(fieldName + "은(는) 필수입니다.");
        }
    }

    private static void requireText(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + "은(는) 필수입니다.");
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public Long getId() {
        return id;
    }

    public String getEmployeeNo() {
        return employeeNo;
    }

    public String getName() {
        return name;
    }

    public String getDepartment() {
        return department;
    }

    public String getPosition() {
        return position;
    }

    public String getPhone() {
        return phone;
    }

    public String getEmail() {
        return email;
    }

    public LocalDate getHireDate() {
        return hireDate;
    }

    public EmploymentStatus getEmploymentStatus() {
        return employmentStatus;
    }

    public LocalDate getResignationDate() {
        return resignationDate;
    }

    public LocalDateTime getDeletedAt() {
        return deletedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
