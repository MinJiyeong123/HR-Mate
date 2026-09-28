# HR Mate

인사팀 업무 지원을 위한 인사·급여 관리 웹서비스 포트폴리오 프로젝트입니다.

> **고지 사항**
> - 이 프로젝트는 **가상의 직원 데이터만** 사용합니다. 실제 개인정보를 입력하지 마세요.
> - 실제 급여 지급이나 세무 신고에 사용할 수 있는 **공식 시스템이 아닙니다.**
> - 급여·연말정산 계산 결과는 계산 규칙이 공식 기준으로 검증되기 전까지 **시뮬레이션(포트폴리오용) 결과**입니다.

## 기술 스택

| 구분 | 기술 |
|---|---|
| 프론트엔드 | React (Vite) |
| 백엔드 | Spring Boot (Java 17, Gradle) |
| 데이터베이스 | MariaDB |

## 개발 범위

- **1차 MVP (진행 중)**: 직원 정보 관리 — 등록, 목록, 상세 조회, 수정, 퇴사 처리, 논리적 삭제
- **추후 단계**: 월별 급여 관리 → 연간 급여 집계 → 연말정산 자료 입력 → 연말정산 계산 및 결과 확인

1차 MVP의 확정 규칙은 [docs/requirements-mvp1.md](docs/requirements-mvp1.md)에 정리되어 있습니다.

## 폴더 구조

```
HR-Mate/
├─ README.md
├─ CLAUDE.md            개발 지침
├─ docs/                요구사항, 진행 기록
├─ backend/             Spring Boot 서버 (사원 API)
└─ frontend/            React 화면 (백엔드 API와 연결)
```

## 실행 방법

Windows PowerShell 기준입니다. **터미널 2개**를 열어 백엔드 → 프론트엔드 순서로 실행합니다.
화면(5173)의 `/api` 요청은 Vite 프록시가 백엔드(8080)로 전달합니다.

### 1. 백엔드 (터미널 1)

API 명세: [사원 API](docs/api/employee-api.md), [급여 API](docs/api/payroll-api.md) (급여는 포트폴리오용 시뮬레이션: 급여 기간 목록·만들기·상세·확정, 급여 입력·수정·삭제, 급여명세서 보기·인쇄. 세금·보험료는 직접 입력하며 자동 계산하지 않음)

사전 준비: [docs/setup-database.md](docs/setup-database.md)대로 `hr_mate` DB와 `hrmate_app` 계정을 만듭니다.

1. 로컬 설정 파일을 만듭니다. (처음 한 번)

   ```powershell
   cd C:\Users\ADMIN\Desktop\HR-Mate
   Copy-Item backend\src\main\resources\application-local.yml.example backend\src\main\resources\application-local.yml
   ```

2. `application-local.yml`을 편집기로 열어 앱 계정 비밀번호를 직접 입력하고 저장합니다.
   이 파일은 Git에서 제외됩니다. 비밀번호를 채팅이나 다른 파일에 적지 않습니다.

3. 서버를 실행합니다.

   ```powershell
   cd C:\Users\ADMIN\Desktop\HR-Mate\backend
   .\gradlew.bat bootRun
   ```

   로그에 `Started HrMateApplication`이 나오면 성공입니다. 종료는 `Ctrl + C`.

### 2. 프론트엔드 (터미널 2)

처음 한 번만 라이브러리를 설치합니다.

```powershell
cd C:\Users\ADMIN\Desktop\HR-Mate\frontend
npm install
```

개발 서버 실행:

```powershell
npm run dev
```

브라우저에서 http://localhost:5173 을 엽니다. 종료는 터미널에서 `Ctrl + C`.

- 등록·수정·삭제한 내용은 개발용 DB(`hr_mate`)에 저장됩니다. 가상 데이터만 입력하세요.
- 삭제는 논리 삭제라 삭제한 사원의 사번은 다시 사용할 수 없습니다.
- 백엔드가 꺼져 있으면 화면에 "서버에 연결할 수 없습니다" 안내가 나옵니다.

## 데모 데이터와 시연

시연용 가상 사원 12명(재직 10, 퇴사 2)을 개발 DB에 넣을 수 있습니다.

- 파일: [docs/sample-data/sample-employees.sql](docs/sample-data/sample-employees.sql)
- 넣는 방법과 시연 순서: [docs/demo-guide.md](docs/demo-guide.md)
- 모든 인물·연락처는 가상입니다. 이메일은 `example.com`만 사용하고 전화번호는 비워 둡니다.
- 추가(INSERT)만 하며 여러 번 실행해도 중복되지 않습니다. 초기화는 필요 없습니다.
- 한 번 넣은 데이터는 되돌리기 어려우니 내용을 확인한 뒤 실행하세요.

## 백엔드 테스트

테스트는 개발 DB(`hr_mate`)가 아닌 테스트 전용 DB(`hr_mate_test`)에 연결합니다.
처음 한 번 [docs/setup-test-database.md](docs/setup-test-database.md)대로 테스트 DB·계정과 `application-test-local.yml`을 준비합니다.

```powershell
cd C:\Users\ADMIN\Desktop\HR-Mate\backend
.\gradlew.bat test
```

테스트 비밀번호 파일이 없거나 비밀번호가 틀리면 DB 테스트가 실패합니다. 개발 DB로 대신 연결하지 않습니다.

## 진행 상황

[docs/progress.md](docs/progress.md)를 참고하세요.
