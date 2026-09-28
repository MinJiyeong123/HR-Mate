# 테스트 DB 준비 가이드 (5단계)

백엔드 자동 테스트가 개발 DB(`hr_mate`) 대신 사용할 테스트 전용 DB(`hr_mate_test`)와 계정(`hrmate_test`)을 만듭니다.

> **원칙**
> - 테스트는 개발 DB에 접속하지 않습니다. 테스트 계정은 `hr_mate_test`에만 권한이 있습니다.
> - 이 문서의 SQL에는 `hr_mate`를 변경하는 문장이 없습니다.
> - 비밀번호는 채팅, 코드, Git에 적지 않습니다. `여기에_테스트용_비밀번호`는 자리표시입니다.

## 구성

| 항목 | 개발 | 테스트 |
|---|---|---|
| DB | `hr_mate` | `hr_mate_test` |
| 계정 | `hrmate_app` | `hrmate_test` (hr_mate_test 전용) |
| 스프링 프로필 | `local` (bootRun) | `test` (gradlew test) |
| 설정 파일 | `application.yml` + `application-local.yml` | `src/test/resources/application-test.yml` + `application-test-local.yml` |
| 테이블 생성 | Flyway | Flyway (테스트 실행 시 hr_mate_test 에 자동 적용) |

## 1. 작업 전 개발 DB 기준값 기록 (HR Mate - app 세션, 조회만)

```sql
SELECT COUNT(*) FROM hr_mate.employee;
SELECT AUTO_INCREMENT FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = 'hr_mate' AND TABLE_NAME = 'employee';
SELECT MAX(version) FROM hr_mate.flyway_schema_history;
```

숫자만 기록합니다. 테스트 후 같은 값이어야 합니다.

## 2. 테스트 DB와 계정 만들기 (HR Mate - root 세션)

사전 확인 (둘 다 비어 있어야 함):

```sql
SHOW DATABASES LIKE 'hr_mate_test';
SELECT User, Host FROM mysql.user WHERE User = 'hrmate_test';
```

생성 (비밀번호 자리만 직접 바꾸고, 실행 후 쿼리 탭 내용을 지웁니다):

```sql
CREATE DATABASE hr_mate_test
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'hrmate_test'@'localhost' IDENTIFIED BY '여기에_테스트용_비밀번호';

GRANT ALL PRIVILEGES ON hr_mate_test.* TO 'hrmate_test'@'localhost';
```

## 3. 권한 분리 확인 (HR Mate - test 세션, hrmate_test 계정)

```sql
SELECT CURRENT_USER();
SHOW DATABASES;
```

- `CURRENT_USER()` = `hrmate_test@localhost`
- `SHOW DATABASES`에 `hr_mate`가 보이지 않아야 합니다.

## 4. 테스트 비밀번호 파일 만들기

아래 명령의 `C:\work\HR-Mate`는 예시 경로입니다. 저장소를 받은 실제 폴더 경로로 바꿔 입력하세요.

```powershell
cd C:\work\HR-Mate
Copy-Item backend\src\test\resources\application-test-local.yml.example backend\src\test\resources\application-test-local.yml
```

복사한 `application-test-local.yml`에 테스트 계정 비밀번호를 직접 입력하고 저장합니다. 이 파일은 Git에서 제외됩니다.

## 5. 테스트 실행과 확인

```powershell
cd C:\work\HR-Mate\backend
.\gradlew.bat test
```

- `TestDatabaseGuardTest`가 연결된 DB가 `hr_mate_test`, 계정이 `hrmate_test`인지 확인합니다.
- 테스트 비밀번호 파일이 없거나 비밀번호가 틀리면 테스트가 실패합니다. 개발 DB로 넘어가지 않습니다.
- 테스트 후 1번의 조회를 다시 실행해 개발 DB 값이 바뀌지 않았는지 확인합니다.
- 테스트 DB 확인 (HR Mate - test 세션):

```sql
SELECT MAX(version) FROM hr_mate_test.flyway_schema_history;  -- 1
SELECT COUNT(*) FROM hr_mate_test.employee;                   -- 0 (테스트는 롤백)
```
