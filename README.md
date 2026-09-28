# HR Mate

인사팀 업무 지원을 위한 인사·급여 관리 웹서비스 포트폴리오 프로젝트입니다.

> **고지 사항**
> - 이 프로젝트는 **가상의 직원 데이터만** 사용합니다. 실제 개인정보를 입력하지 마세요.
> - 실제 급여 지급이나 세무 신고에 사용할 수 있는 **공식 시스템이 아닙니다.**
> - 급여·연말정산 계산 결과는 계산 규칙이 공식 기준으로 검증되기 전까지 **시뮬레이션(포트폴리오용) 결과**입니다.
> - 연말정산은 2025년 귀속 규칙(소득세법·국세청 안내 조사 기준)으로 계산한 **모의 계산**입니다. 전문가 검증 전이며, 지방소득세는 포함하지 않고, 일부 계산 방식은 가정입니다. 공식 연말정산 결과가 아닙니다.

## 기술 스택

| 구분 | 기술 |
|---|---|
| 프론트엔드 | React (Vite) |
| 백엔드 | Spring Boot (Java 17, Gradle) |
| 데이터베이스 | MariaDB |

## 개발 범위

| 단계 | 내용 | 상태 |
|---|---|---|
| 1차 | 직원 정보 관리 — 등록, 목록, 상세 조회, 수정, 퇴사 처리, 논리적 삭제 | 완료 |
| 2차 | 월별 급여 관리 — 급여 기간, 급여 입력·수정·삭제, 확정, 급여명세서·인쇄 (시뮬레이션) | 완료 |
| 3차 | 연간 급여 집계 — 귀속 연도 기준, 확정된 기간만 합산, 사원별 월별 내역 (시뮬레이션, 전문가 검증 전) | 완료 |
| 4차 | 연말정산 모의 계산 — 사원·연도별 입력 자료(인원 수·해당 여부만, 개인 식별 정보 없음), 확정 급여 합계로 근로소득공제·인적공제·보험료/연금보험료 공제·기본세율·근로소득/자녀/표준세액공제 계산, 기납부세액과 비교해 추가 납부/환급 표시 (모의 계산, 2025년 귀속 규칙, 전문가 검증 전, 지방소득세 미포함) | 완료 |
| 추후 후보 | 이번 범위에서 제외한 공제(신용카드·의료비·교육비·기부금·월세 등), 2026년 이후 귀속 규칙, 지방소득세 | 미정 |

규칙 문서: [1차 요구사항](docs/requirements-mvp1.md), [급여 요구사항(2·3차)](docs/requirements-payroll.md), [근로소득 귀속연도 조사](docs/tax-rules/income-attribution.md), [연말정산 요구사항(4차)](docs/requirements-year-end.md), [연말정산 계산 규칙 조사(2025년 귀속)](docs/tax-rules/year-end-settlement-2025.md)

## 폴더 구조

```
HR-Mate/
├─ README.md
├─ CLAUDE.md            개발 지침
├─ docs/                요구사항, API 명세, 세법 조사, 진행 기록
├─ backend/             Spring Boot 서버 (사원·급여·연말정산 API)
└─ frontend/            React 화면 (백엔드 API와 연결)
```

## 실행 방법

Windows PowerShell 기준입니다. **터미널 2개**를 열어 백엔드 → 프론트엔드 순서로 실행합니다.
화면(5173)의 `/api` 요청은 Vite 프록시가 백엔드(8080)로 전달합니다.

> 아래 명령의 `C:\work\HR-Mate`는 예시 경로입니다. 저장소를 받은 실제 폴더 경로로 바꿔 입력하세요.

### 1. 백엔드 (터미널 1)

API 명세: [사원 API](docs/api/employee-api.md), [급여 API](docs/api/payroll-api.md) (급여는 포트폴리오용 시뮬레이션: 급여 기간 목록·만들기·상세·확정, 급여 입력·수정·삭제, 급여명세서 보기·인쇄, 연간 급여 집계. 세금·보험료는 직접 입력하며 자동 계산하지 않음. 연간 집계 기준은 [귀속연도 조사](docs/tax-rules/income-attribution.md) 참고), [연말정산 API](docs/api/year-end-api.md) (모의 계산: 목록, 입력 자료 조회·저장, 계산 결과)

사전 준비: [docs/setup-database.md](docs/setup-database.md)대로 `hr_mate` DB와 `hrmate_app` 계정을 만듭니다.

1. 로컬 설정 파일을 만듭니다. (처음 한 번)

   ```powershell
   cd C:\work\HR-Mate
   Copy-Item backend\src\main\resources\application-local.yml.example backend\src\main\resources\application-local.yml
   ```

2. `application-local.yml`을 편집기로 열어 앱 계정 비밀번호를 직접 입력하고 저장합니다.
   이 파일은 Git에서 제외됩니다. 비밀번호를 채팅이나 다른 파일에 적지 않습니다.

3. 서버를 실행합니다.

   ```powershell
   cd C:\work\HR-Mate\backend
   .\gradlew.bat bootRun
   ```

   로그에 `Started HrMateApplication`이 나오면 성공입니다. 종료는 `Ctrl + C`.
   실행한 터미널은 닫지 말고 그대로 둡니다. 코드가 바뀐 뒤에는 아래 [백엔드 다시 켜기](#백엔드-다시-켜기)를 따릅니다.

### 2. 프론트엔드 (터미널 2)

처음 한 번만 라이브러리를 설치합니다.

```powershell
cd C:\work\HR-Mate\frontend
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

### 백엔드 다시 켜기

백엔드는 **켤 때의 코드로 계속 동작**합니다. 코드를 받거나 바꾼 뒤에는 한 번 끄고 다시 켜야 새 기능이 반영됩니다.
(예: 새 화면에 "–"만 보이거나 새 기능이 "찾을 수 없습니다"로 나올 때)

1. 백엔드를 실행한 터미널에서 `Ctrl + C`로 끕니다. (`일괄 작업을 끝내시겠습니까 (Y/N)?`가 나오면 `Y`)
2. 꺼졌는지 확인합니다. 결과가 `0`이면 8080 포트가 비어 있는 것입니다.

   ```powershell
   @(Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue).Count
   ```

3. `1`이 나오면 백엔드가 Gradle 데몬(백그라운드 도우미) 아래에 남아 있는 것입니다. Gradle 데몬을 멈추고 2번을 다시 확인합니다.

   ```powershell
   cd C:\work\HR-Mate\backend
   .\gradlew.bat --stop
   ```

4. `.\gradlew.bat bootRun`으로 다시 실행합니다. 새 마이그레이션이 없으면 DB 데이터는 바뀌지 않습니다.

## 데모 데이터와 시연

시연용 가상 사원 12명(재직 10, 퇴사 2)을 개발 DB에 넣을 수 있습니다.

- 파일: [docs/sample-data/sample-employees.sql](docs/sample-data/sample-employees.sql)
- 넣는 방법과 시연 순서: [docs/demo-guide.md](docs/demo-guide.md) (사원 관리 시연, 급여 관리·연간 급여 집계·연말정산 모의 계산 시연 시나리오, 주의사항, 문제 해결 포함)
- 모든 인물·연락처는 가상입니다. 이메일은 `example.com`만 사용하고 전화번호는 비워 둡니다.
- 추가(INSERT)만 하며 여러 번 실행해도 중복되지 않습니다. 초기화는 필요 없습니다.
- 한 번 넣은 데이터는 되돌리기 어려우니 내용을 확인한 뒤 실행하세요.

## 백엔드 테스트

테스트는 개발 DB(`hr_mate`)가 아닌 테스트 전용 DB(`hr_mate_test`)에 연결합니다.
처음 한 번 [docs/setup-test-database.md](docs/setup-test-database.md)대로 테스트 DB·계정과 `application-test-local.yml`을 준비합니다.

```powershell
cd C:\work\HR-Mate\backend
.\gradlew.bat test
```

테스트 비밀번호 파일이 없거나 비밀번호가 틀리면 DB 테스트가 실패합니다. 개발 DB로 대신 연결하지 않습니다.

## 진행 상황

[docs/progress.md](docs/progress.md)를 참고하세요.
