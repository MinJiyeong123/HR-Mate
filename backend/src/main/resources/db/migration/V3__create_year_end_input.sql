-- 연말정산 입력 자료 (4차, 포트폴리오용 모의 계산)
-- 규칙 출처: docs/requirements-year-end.md 4장·7장
-- - 이름·주민등록번호·생년월일 등 개인 식별 정보는 저장하지 않고, 인원 수와 해당 여부만 저장한다.
-- - 계산 결과는 저장하지 않는다(조회할 때마다 확정 급여로 계산).
-- - 사원은 employee.id(내부 ID)로 참조하며, 사원·귀속연도별 1건이다.

CREATE TABLE year_end_input (
    id                      BIGINT      NOT NULL AUTO_INCREMENT,
    employee_id             BIGINT      NOT NULL,
    tax_year                INT         NOT NULL,
    spouse_deduction        BOOLEAN     NOT NULL,
    dependent_count         INT         NOT NULL,
    elderly_count           INT         NOT NULL,
    disabled_count          INT         NOT NULL,
    woman_deduction         BOOLEAN     NOT NULL,
    single_parent_deduction BOOLEAN     NOT NULL,
    child_credit_count      INT         NOT NULL,
    birth_first_count       INT         NOT NULL,
    birth_second_count      INT         NOT NULL,
    birth_third_plus_count  INT         NOT NULL,
    created_at              DATETIME(6) NOT NULL,
    updated_at              DATETIME(6) NOT NULL,

    CONSTRAINT pk_year_end_input PRIMARY KEY (id),
    CONSTRAINT uk_year_end_input_employee_year UNIQUE (employee_id, tax_year),
    CONSTRAINT fk_year_end_input_employee FOREIGN KEY (employee_id)
        REFERENCES employee (id) ON DELETE RESTRICT,
    CONSTRAINT ck_year_end_input_year CHECK (tax_year BETWEEN 2000 AND 2100),
    CONSTRAINT ck_year_end_input_dependent CHECK (dependent_count BETWEEN 0 AND 20),
    -- 경로우대·장애인 ≤ 기본공제 대상자 수(본인 1 + 배우자 + 부양가족)
    CONSTRAINT ck_year_end_input_elderly CHECK (
        elderly_count >= 0 AND elderly_count <= 1 + spouse_deduction + dependent_count
    ),
    CONSTRAINT ck_year_end_input_disabled CHECK (
        disabled_count >= 0 AND disabled_count <= 1 + spouse_deduction + dependent_count
    ),
    CONSTRAINT ck_year_end_input_single_parent CHECK (
        NOT (spouse_deduction AND single_parent_deduction)
    ),
    CONSTRAINT ck_year_end_input_child CHECK (child_credit_count BETWEEN 0 AND dependent_count),
    CONSTRAINT ck_year_end_input_birth CHECK (
        birth_first_count BETWEEN 0 AND 1
        AND birth_second_count BETWEEN 0 AND 1
        AND birth_third_plus_count BETWEEN 0 AND 10
        AND birth_first_count + birth_second_count + birth_third_plus_count <= dependent_count
    )
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
