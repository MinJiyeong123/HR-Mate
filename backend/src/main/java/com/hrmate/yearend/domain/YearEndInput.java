package com.hrmate.yearend.domain;

import com.hrmate.employee.domain.Employee;
import com.hrmate.yearend.calculator.PersonalDeductionInput;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/**
 * 연말정산 입력 자료 (테이블: year_end_input) - 포트폴리오용 모의 계산
 *
 * <ul>
 *   <li>사원·귀속연도별 1건. 인원 수와 해당 여부만 저장하고 개인 식별 정보는 저장하지 않는다.</li>
 *   <li>값 검증은 {@link PersonalDeductionInput} 이 한다(IllegalArgumentException).</li>
 *   <li>논리 삭제된 사원의 자료는 만들 수 없다.</li>
 * </ul>
 */
@Entity
@Table(name = "year_end_input")
public class YearEndInput {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "employee_id", nullable = false, updatable = false)
    private Employee employee;

    @Column(name = "tax_year", nullable = false, updatable = false)
    private int taxYear;

    @Column(name = "spouse_deduction", nullable = false)
    private boolean spouseDeduction;

    @Column(name = "dependent_count", nullable = false)
    private int dependentCount;

    @Column(name = "elderly_count", nullable = false)
    private int elderlyCount;

    @Column(name = "disabled_count", nullable = false)
    private int disabledCount;

    @Column(name = "woman_deduction", nullable = false)
    private boolean womanDeduction;

    @Column(name = "single_parent_deduction", nullable = false)
    private boolean singleParentDeduction;

    @Column(name = "child_credit_count", nullable = false)
    private int childCreditCount;

    @Column(name = "birth_first_count", nullable = false)
    private int birthFirstCount;

    @Column(name = "birth_second_count", nullable = false)
    private int birthSecondCount;

    @Column(name = "birth_third_plus_count", nullable = false)
    private int birthThirdPlusCount;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /** JPA 전용 기본 생성자 */
    protected YearEndInput() {
    }

    public static YearEndInput create(Employee employee, int taxYear, PersonalDeductionInput values) {
        if (employee == null || values == null) {
            throw new IllegalArgumentException("사원과 입력 자료는 필수입니다.");
        }
        if (employee.isDeleted()) {
            throw new IllegalArgumentException("삭제된 사원의 연말정산 자료는 만들 수 없습니다.");
        }
        YearEndInput input = new YearEndInput();
        input.employee = employee;
        input.taxYear = taxYear;
        input.apply(values);
        return input;
    }

    /** 입력 값 전체 교체 */
    public void change(PersonalDeductionInput values) {
        if (values == null) {
            throw new IllegalArgumentException("입력 자료는 필수입니다.");
        }
        apply(values);
    }

    /** 계산기 입력으로 변환 (저장된 값도 다시 검증된다) */
    public PersonalDeductionInput toPersonalDeductionInput() {
        return new PersonalDeductionInput(spouseDeduction, dependentCount, elderlyCount, disabledCount,
                womanDeduction, singleParentDeduction, childCreditCount, birthFirstCount, birthSecondCount,
                birthThirdPlusCount);
    }

    private void apply(PersonalDeductionInput values) {
        this.spouseDeduction = values.spouseDeduction();
        this.dependentCount = values.dependentCount();
        this.elderlyCount = values.elderlyCount();
        this.disabledCount = values.disabledCount();
        this.womanDeduction = values.womanDeduction();
        this.singleParentDeduction = values.singleParentDeduction();
        this.childCreditCount = values.childCreditCount();
        this.birthFirstCount = values.birthFirstCount();
        this.birthSecondCount = values.birthSecondCount();
        this.birthThirdPlusCount = values.birthThirdPlusCount();
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

    public Long getId() {
        return id;
    }

    public Employee getEmployee() {
        return employee;
    }

    public int getTaxYear() {
        return taxYear;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
