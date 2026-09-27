# DB 준비 가이드 (1단계)

HR Mate가 사용할 데이터베이스(`hr_mate`)와 앱 전용 계정(`hrmate_app`)을 만듭니다.

> **비밀번호 원칙**
> - root 비밀번호와 앱 계정 비밀번호는 **채팅, 코드, Git 어디에도 적지 않습니다.**
> - 이 문서의 `여기에_직접_정한_비밀번호`는 자리표시입니다. 실제 비밀번호는 HeidiSQL 화면에서만 직접 입력합니다.

## 확인된 환경

| 항목 | 값 |
|---|---|
| MariaDB 버전 | 11.8 (Windows 서비스, 자동 시작) |
| 포트 | 3306 |
| 접속 도구 | HeidiSQL (시작 메뉴 → MariaDB 11.8 (x64) → HeidiSQL(x64)) |

## 만들 것

| 대상 | 이름 | 설명 |
|---|---|---|
| 데이터베이스 | `hr_mate` | 문자셋 `utf8mb4` (한글·이모지 저장 가능) |
| 앱 전용 계정 | `hrmate_app@localhost` | 이 PC에서만 접속 가능, `hr_mate` DB에만 권한 |

앱이 root 계정을 쓰지 않는 이유: root는 모든 DB를 지우거나 바꿀 수 있습니다. 앱 코드에 문제가 생겨도 `hr_mate` 밖에는 영향이 없도록 권한을 좁힙니다.

## 앱 계정 비밀번호 정하기

- root와 **다른** 비밀번호로 새로 정합니다.
- 12자 이상, 영문 대소문자·숫자 조합을 권장합니다.
- 작은따옴표(`'`), 큰따옴표(`"`), 역슬래시(`\`)는 사용하지 않습니다. SQL·설정 파일에서 오류를 일으킬 수 있습니다.
- 2단계에서 `application-local.yml`에 다시 입력해야 하므로 안전한 곳(비밀번호 관리 프로그램 등)에 보관합니다.

## A. root로 접속하기 (HeidiSQL)

1. 시작 메뉴 → **MariaDB 11.8 (x64) → HeidiSQL(x64)** 실행
2. 세션 관리자 창에서 왼쪽 아래 **신규(New)** 클릭, 세션 이름은 `HR Mate - root`
3. 오른쪽 설정 입력

   | 항목 | 값 |
   |---|---|
   | 네트워크 유형 | MariaDB or MySQL (TCP/IP) |
   | 호스트명 / IP | `127.0.0.1` |
   | 사용자 | `root` |
   | 암호 | (직접 입력) |
   | 포트 | `3306` |

4. **열기(Open)** 클릭

## B. 사전 확인 (비밀번호 없는 쿼리)

쿼리 탭에 입력하고 실행(F9)합니다.

```sql
SELECT VERSION();
SHOW DATABASES LIKE 'hr_mate';
SELECT User, Host FROM mysql.user WHERE User = 'hrmate_app';
```

- 버전이 `11.8.x-MariaDB`로 나오는지 확인합니다.
- 두 번째·세 번째 결과가 **비어 있어야** 합니다. 비어 있지 않다면 진행을 멈추고 확인합니다.

## C. DB와 계정 만들기

1. 쿼리 탭에 아래 SQL을 붙여 넣습니다.
2. `여기에_직접_정한_비밀번호` 부분만 실제 비밀번호로 바꿉니다. **작은따옴표는 그대로 둡니다.**
3. 실행(F9)합니다.

```sql
CREATE DATABASE hr_mate
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'hrmate_app'@'localhost' IDENTIFIED BY '여기에_직접_정한_비밀번호';

GRANT ALL PRIVILEGES ON hr_mate.* TO 'hrmate_app'@'localhost';
```

4. **실행 직후 쿼리 탭의 내용을 모두 지웁니다.** HeidiSQL은 쿼리 탭 내용을 자동으로 백업해 두기 때문에, 비밀번호가 남지 않도록 합니다. 이 SQL을 `.sql` 파일로 저장하지 않습니다.

`ALL PRIVILEGES ON hr_mate.*`는 `hr_mate` DB 안에서만 모든 권한을 준다는 뜻입니다. 테이블 생성(Flyway)에 필요합니다. 다른 DB에는 권한이 없습니다.

## D. 결과 확인 (root 세션, 비밀번호 없는 쿼리)

```sql
SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME
  FROM information_schema.SCHEMATA
 WHERE SCHEMA_NAME = 'hr_mate';

SHOW GRANTS FOR 'hrmate_app'@'localhost';
```

- 문자셋 `utf8mb4`, 정렬 규칙 `utf8mb4_unicode_ci`
- 권한에 `GRANT ALL PRIVILEGES ON `hr_mate`.* TO `hrmate_app`@`localhost`` 포함
- 첫 줄 `GRANT USAGE ... IDENTIFIED BY PASSWORD '*...'`의 `*`로 시작하는 값은 비밀번호 원문이 아니라 암호화된 값입니다. 그래도 공유하지 않습니다.

## E. 앱 계정으로 접속 확인

1. HeidiSQL 세션 관리자에서 새 세션 `HR Mate - app` 생성
2. 호스트 `127.0.0.1`, 사용자 `hrmate_app`, 암호(직접 입력), 포트 `3306`
3. 접속 후 실행:

```sql
SELECT CURRENT_USER();
SHOW DATABASES;
```

- `CURRENT_USER()` 결과: `hrmate_app@localhost`
- `SHOW DATABASES` 결과: `hr_mate`와 `information_schema`만 보이면 성공입니다.

## 되돌리기 (실수했을 때만, root 세션에서)

아직 테이블이 없는 1단계에서만 사용합니다. 테이블과 데이터가 생긴 뒤에는 실행하지 않습니다.

```sql
DROP USER 'hrmate_app'@'localhost';
DROP DATABASE hr_mate;
```
