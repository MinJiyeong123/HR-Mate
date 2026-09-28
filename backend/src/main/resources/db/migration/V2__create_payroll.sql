-- 월별 급여 관리 (2차, 포트폴리오용 시뮬레이션)
-- 규칙 출처: docs/requirements-payroll.md
-- - 금액은 원 단위 정수(BIGINT). 시스템은 합계·실지급액만 계산한다.
-- - 소득세·지방소득세·4대보험료는 자동 산출하지 않는다. 공제 항목 금액은 수동 입력이다.
-- - 비과세(NON_TAXABLE)는 분류 표시만 하며 법령상 한도는 검사하지 않는다.
-- - 급여 기록은 사번이 아닌 employee.id(내부 ID)를 참조한다.

-- 지급·공제 항목 (기준 데이터)
CREATE TABLE pay_item (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    code       VARCHAR(40) NOT NULL,
    name       VARCHAR(50) NOT NULL,
    category   VARCHAR(20) NOT NULL,
    tax_type   VARCHAR(20) NOT NULL,
    sort_order INT         NOT NULL,
    active     BOOLEAN     NOT NULL DEFAULT TRUE,

    CONSTRAINT pk_pay_item PRIMARY KEY (id),
    CONSTRAINT uk_pay_item_code UNIQUE (code),
    CONSTRAINT ck_pay_item_category CHECK (category IN ('EARNING', 'DEDUCTION')),
    CONSTRAINT ck_pay_item_tax_type CHECK (
        (category = 'EARNING' AND tax_type IN ('TAXABLE', 'NON_TAXABLE'))
        OR (category = 'DEDUCTION' AND tax_type = 'NONE')
    )
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- 급여 기간 (귀속 연월당 1개)
CREATE TABLE payroll_period (
    id           BIGINT      NOT NULL AUTO_INCREMENT,
    pay_year     INT         NOT NULL,
    pay_month    INT         NOT NULL,
    payment_date DATE        NOT NULL,
    status       VARCHAR(20) NOT NULL,
    confirmed_at DATETIME(6) NULL,
    created_at   DATETIME(6) NOT NULL,
    updated_at   DATETIME(6) NOT NULL,

    CONSTRAINT pk_payroll_period PRIMARY KEY (id),
    CONSTRAINT uk_payroll_period_year_month UNIQUE (pay_year, pay_month),
    CONSTRAINT ck_payroll_period_year CHECK (pay_year BETWEEN 2000 AND 2100),
    CONSTRAINT ck_payroll_period_month CHECK (pay_month BETWEEN 1 AND 12),
    CONSTRAINT ck_payroll_period_status CHECK (status IN ('DRAFT', 'CONFIRMED'))
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- 사원별 월 급여
CREATE TABLE payroll (
    id                BIGINT       NOT NULL AUTO_INCREMENT,
    payroll_period_id BIGINT       NOT NULL,
    employee_id       BIGINT       NOT NULL,
    -- 작성 당시 사원 정보 (스냅샷)
    employee_no       VARCHAR(20)  NOT NULL,
    employee_name     VARCHAR(50)  NOT NULL,
    department        VARCHAR(100) NULL,
    position          VARCHAR(50)  NULL,
    total_earnings    BIGINT       NOT NULL,
    total_deductions  BIGINT       NOT NULL,
    net_pay           BIGINT       NOT NULL,
    memo              VARCHAR(200) NULL,
    created_at        DATETIME(6)  NOT NULL,
    updated_at        DATETIME(6)  NOT NULL,

    CONSTRAINT pk_payroll PRIMARY KEY (id),
    CONSTRAINT uk_payroll_period_employee UNIQUE (payroll_period_id, employee_id),
    CONSTRAINT fk_payroll_period FOREIGN KEY (payroll_period_id)
        REFERENCES payroll_period (id) ON DELETE RESTRICT,
    CONSTRAINT fk_payroll_employee FOREIGN KEY (employee_id)
        REFERENCES employee (id) ON DELETE RESTRICT,
    CONSTRAINT ck_payroll_totals CHECK (
        total_earnings >= 0
        AND total_deductions >= 0
        AND net_pay >= 0
        AND net_pay = total_earnings - total_deductions
    )
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- 급여 항목별 금액 (0원 항목은 저장하지 않음)
CREATE TABLE payroll_line (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    payroll_id  BIGINT      NOT NULL,
    pay_item_id BIGINT      NOT NULL,
    -- 작성 당시 항목 정보 (스냅샷)
    item_name   VARCHAR(50) NOT NULL,
    category    VARCHAR(20) NOT NULL,
    tax_type    VARCHAR(20) NOT NULL,
    amount      BIGINT      NOT NULL,

    CONSTRAINT pk_payroll_line PRIMARY KEY (id),
    CONSTRAINT uk_payroll_line_item UNIQUE (payroll_id, pay_item_id),
    CONSTRAINT fk_payroll_line_payroll FOREIGN KEY (payroll_id)
        REFERENCES payroll (id) ON DELETE CASCADE,
    CONSTRAINT fk_payroll_line_pay_item FOREIGN KEY (pay_item_id)
        REFERENCES pay_item (id) ON DELETE RESTRICT,
    CONSTRAINT ck_payroll_line_amount CHECK (amount BETWEEN 1 AND 1000000000),
    CONSTRAINT ck_payroll_line_tax_type CHECK (
        (category = 'EARNING' AND tax_type IN ('TAXABLE', 'NON_TAXABLE'))
        OR (category = 'DEDUCTION' AND tax_type = 'NONE')
    )
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- 기본 항목 12개 (공제 항목은 모두 수동 입력, 자동 산출 아님)
INSERT INTO pay_item (code, name, category, tax_type, sort_order, active) VALUES
    ('BASE_SALARY',          '기본급',       'EARNING',   'TAXABLE',     10,  TRUE),
    ('OVERTIME_PAY',         '연장근로수당', 'EARNING',   'TAXABLE',     20,  TRUE),
    ('BONUS',                '상여금',       'EARNING',   'TAXABLE',     30,  TRUE),
    ('MEAL_ALLOWANCE',       '식대',         'EARNING',   'NON_TAXABLE', 40,  TRUE),
    ('OTHER_ALLOWANCE',      '기타수당',     'EARNING',   'TAXABLE',     50,  TRUE),
    ('INCOME_TAX',           '소득세',       'DEDUCTION', 'NONE',        110, TRUE),
    ('LOCAL_INCOME_TAX',     '지방소득세',   'DEDUCTION', 'NONE',        120, TRUE),
    ('NATIONAL_PENSION',     '국민연금',     'DEDUCTION', 'NONE',        130, TRUE),
    ('HEALTH_INSURANCE',     '건강보험',     'DEDUCTION', 'NONE',        140, TRUE),
    ('LONG_TERM_CARE',       '장기요양보험', 'DEDUCTION', 'NONE',        150, TRUE),
    ('EMPLOYMENT_INSURANCE', '고용보험',     'DEDUCTION', 'NONE',        160, TRUE),
    ('OTHER_DEDUCTION',      '기타공제',     'DEDUCTION', 'NONE',        170, TRUE);
