-- ============================================================
-- HR Mate 데모용 가상 사원 데이터 (12명: 재직 10, 퇴사 2)
--
-- - 모든 인물·연락처는 가상입니다. 실존 인물과 무관합니다.
-- - 이메일은 예시용 예약 도메인(example.com)만 사용합니다.
-- - 전화번호는 실제 번호와 겹칠 수 있어 모두 비워 둡니다(NULL).
-- - 주민등록번호, 주소, 계좌번호 등 민감정보는 없습니다.
--
-- 실행 방법: docs/demo-guide.md 참고
-- - HeidiSQL "HR Mate - app" 세션(hrmate_app 계정)에서 실행합니다.
-- - 이 파일은 INSERT 만 합니다. 기존 행을 수정·삭제하지 않습니다.
-- - 같은 사번이 이미 있으면 그 행은 건너뜁니다(ON DUPLICATE KEY UPDATE 로 값 변경 없음).
--   여러 번 실행해도 중복으로 추가되지 않습니다.
-- - 12명이 한 문장으로 들어가므로, 한 명이라도 규칙에 어긋나면 12명 모두 들어가지 않습니다.
-- - 마지막 COMMIT 으로 입력을 확정합니다. 자동 커밋이 꺼진 세션에서도 세션을 닫을 때 입력이 취소되지 않게 합니다.
--   (자동 커밋이 켜져 있으면 COMMIT 은 아무 영향이 없습니다.)
-- - 실행 후에는 같은 세션이 아니라 새 세션이나 브라우저에서 12명이 보이는지 확인합니다.
-- - 사번 E2026001 은 시연 중 등록용으로 비워 둡니다.
-- ============================================================

USE hr_mate;

INSERT INTO employee
    (employee_no, name, department, position, phone, email, hire_date, employment_status, resignation_date, created_at, updated_at)
VALUES
    ('E2018002', '서유진', '재무팀',   '부장', NULL, 'yujin.seo@example.com',     '2018-01-02', 'ACTIVE',   NULL,         NOW(6), NOW(6)),
    ('E2019001', '김하늘', '인사팀',   '과장', NULL, 'haneul.kim@example.com',    '2019-03-04', 'ACTIVE',   NULL,         NOW(6), NOW(6)),
    ('E2020003', '이서준', '재무팀',   '대리', NULL, 'seojun.lee@example.com',    '2020-07-01', 'ACTIVE',   NULL,         NOW(6), NOW(6)),
    ('E2020011', '임준호', '영업팀',   '차장', NULL, 'junho.lim@example.com',     '2020-11-02', 'ACTIVE',   NULL,         NOW(6), NOW(6)),
    ('E2021002', '박지우', '개발팀',   '선임', NULL, 'jiwoo.park@example.com',    '2021-01-11', 'ACTIVE',   NULL,         NOW(6), NOW(6)),
    ('E2021007', '최민서', '영업팀',   '사원', NULL, NULL,                        '2021-09-01', 'RESIGNED', '2024-06-30', NOW(6), NOW(6)),
    ('E2022004', '정예린', '인사팀',   '대리', NULL, 'yerin.jung@example.com',    '2022-02-14', 'ACTIVE',   NULL,         NOW(6), NOW(6)),
    ('E2023001', '강도윤', '개발팀',   '사원', NULL, 'doyun.kang@example.com',    '2023-01-02', 'ACTIVE',   NULL,         NOW(6), NOW(6)),
    ('E2023005', '윤채원', '마케팅팀', '주임', NULL, 'chaewon.yoon@example.com',  '2023-05-15', 'RESIGNED', '2025-12-31', NOW(6), NOW(6)),
    ('E2024002', '한지호', NULL,       NULL,   NULL, NULL,                        '2024-08-19', 'ACTIVE',   NULL,         NOW(6), NOW(6)),
    ('E2025003', '조하은', '마케팅팀', '사원', NULL, 'haeun.jo@example.com',      '2025-03-04', 'ACTIVE',   NULL,         NOW(6), NOW(6)),
    ('E2025011', '배지민', '개발팀',   '사원', NULL, 'jimin.bae@example.com',     '2025-11-03', 'ACTIVE',   NULL,         NOW(6), NOW(6))
ON DUPLICATE KEY UPDATE employee_no = employee_no;

COMMIT;
