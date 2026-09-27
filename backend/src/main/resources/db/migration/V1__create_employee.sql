-- 사원 기본 정보 (1차 MVP)
-- 규칙 출처: docs/requirements-mvp1.md
-- - id: 내부 식별자(기본 키). 이후 급여·연말정산 테이블은 사번이 아닌 이 값을 참조한다.
-- - employee_no: 사번. 영문 대문자·숫자 1~20자, 중복 불가(논리 삭제된 사원 포함), 등록 후 변경 불가.
-- - deleted_at: 논리 삭제 시각. 값이 있으면 삭제된 사원이며, 행 자체는 삭제하지 않는다.
-- - 주민등록번호, 주소, 계좌번호 등 민감정보 컬럼은 두지 않는다.
CREATE TABLE employee (
    id                BIGINT       NOT NULL AUTO_INCREMENT,
    employee_no       VARCHAR(20)  NOT NULL,
    name              VARCHAR(50)  NOT NULL,
    department        VARCHAR(100) NULL,
    position          VARCHAR(50)  NULL,
    phone             VARCHAR(20)  NULL,
    email             VARCHAR(100) NULL,
    hire_date         DATE         NOT NULL,
    employment_status VARCHAR(20)  NOT NULL,
    resignation_date  DATE         NULL,
    deleted_at        DATETIME(6)  NULL,
    created_at        DATETIME(6)  NOT NULL,
    updated_at        DATETIME(6)  NOT NULL,

    CONSTRAINT pk_employee PRIMARY KEY (id),

    -- 컬럼 정렬 규칙(utf8mb4_unicode_ci)이 대소문자를 구분하지 않으므로 E001과 e001은 같은 값으로 취급된다.
    CONSTRAINT uk_employee_employee_no UNIQUE (employee_no),

    -- 영문·숫자만 허용하고, 대문자로 통일해서 저장되었는지 바이너리 비교로 확인한다.
    CONSTRAINT ck_employee_employee_no_format CHECK (
        employee_no REGEXP '^[A-Za-z0-9]{1,20}$'
        AND CAST(employee_no AS BINARY) = CAST(UPPER(employee_no) AS BINARY)
    ),

    CONSTRAINT ck_employee_employment_status CHECK (
        employment_status IN ('ACTIVE', 'RESIGNED')
    ),

    -- 재직: 퇴사일 없음 / 퇴사: 퇴사일 필수, 입사일 이후
    CONSTRAINT ck_employee_resignation_date CHECK (
        (employment_status = 'ACTIVE' AND resignation_date IS NULL)
        OR (employment_status = 'RESIGNED' AND resignation_date IS NOT NULL AND resignation_date >= hire_date)
    )
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
