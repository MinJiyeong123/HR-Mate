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
├─ backend/             Spring Boot 서버 (DB 연결까지 구성)
└─ frontend/            React 화면 (가짜 데이터로 동작 중)
```

## 실행 방법

### 프론트엔드 (현재: 가짜 데이터로 동작)

Windows PowerShell 기준입니다. 처음 한 번만 라이브러리를 설치합니다.

```powershell
cd C:\Users\ADMIN\Desktop\HR-Mate\frontend
npm install
```

개발 서버 실행:

```powershell
npm run dev
```

브라우저에서 http://localhost:5173 을 엽니다. 종료는 터미널에서 `Ctrl + C`.

- 아직 백엔드·DB와 연결되지 않았습니다. `frontend/src/api/employeeApi.js`가 가짜 데이터(`frontend/src/mocks/mockEmployees.js`)로 동작합니다.
- 새로고침하면 등록·수정한 내용이 초기화됩니다.

### 백엔드 (현재: DB 연결까지 구성, API 없음)

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

## 진행 상황

[docs/progress.md](docs/progress.md)를 참고하세요.
