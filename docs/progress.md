# 진행 기록

| 단계 | 내용 | 상태 | 완료일 | 확인한 내용 | 남은 문제 |
|---|---|---|---|---|---|
| 0-A | 개발 도구 준비 (VS Code) | 완료 | 2026-09-27 | VS Code 설치, 한국어 메뉴, Extension Pack for Java, Spring Boot Extension Pack 설치. VS Code 터미널에서 Java 17.0.12, Node.js v24.21.0, npm 11.19.0, Git 2.46.2 확인 | 없음 |
| 0 | 저장소 준비 (Git, .gitignore, 문서, Claude Code 읽기 차단 설정) | 완료 | 2026-09-27 | `git init -b main`, `git status`로 추적 파일 6개 확인, `git check-ignore`로 `application-local.yml`·`.env`·`.env.*`·개인 메모 제외 확인, 첫 커밋 | Claude Code 읽기 차단 설정의 실제 동작은 2단계에서 빈 테스트 파일로 검증 예정 |
| 1 | DB 준비 (hr_mate DB, 앱 전용 계정) | 완료 | 2026-09-27 | 사용자가 HeidiSQL에서 직접 수행. MariaDB 11.8 확인, `hr_mate`(utf8mb4 / utf8mb4_unicode_ci) 생성, `hrmate_app@localhost` 생성 및 `hr_mate.*` 권한 부여(SHOW GRANTS 확인), 앱 계정 접속 시 `hr_mate`·`information_schema`만 보임. 비밀번호 입력 쿼리 탭 삭제 | 없음 |
| 2 | 백엔드 기본 틀 | 완료 | 2026-09-28 | Spring Boot 4.1.1, Java 17, Gradle 9.7.1 (Web MVC, Data JPA, Validation, MariaDB Driver, Flyway + flyway-mysql). `build -x test` 성공. Claude Code의 `application-local.yml` 읽기 차단(Read·Grep·Get-Item) 확인. `bootRun`으로 `hrmate_app` DB 연결(HikariPool Start completed), Flyway가 `flyway_schema_history` 생성, `Started HrMateApplication` 확인. `git status`에 `application-local.yml` 미표시 | 1차 실행 시 `application-local.yml`이 예상 위치에 없어 실패, 2차는 비밀번호 불일치로 실패 → 파일 재생성 및 DB 비밀번호 재설정으로 해결(처음 입력했던 탭의 위치는 미확인). 기본 테스트(`HrMateApplicationTests`)는 실제 DB에 접속하므로 테스트 DB 방식은 5단계에서 결정. 경고 2건(`WSREP_ON` 미존재, Flyway가 MariaDB 11.8 미검증)은 동작에 영향 없음 |
| 3 | 직원 테이블과 엔티티 | 완료 | 2026-09-28 | Flyway V1로 `employee` 테이블 생성(내부 ID 기본 키, 사번 UNIQUE·대문자·형식 CHECK, 재직/퇴사일 CHECK, `deleted_at` 논리 삭제). `bootRun`에서 V1 적용·Hibernate validate 통과·서버 시작 확인. `gradlew test` 22개 통과(엔티티 규칙 8, 리포지토리·DB 제약 13, 컨텍스트 1) | 테스트 후 `employee` 잔여 행이 0건인지 사용자 확인 필요(롤백 방식이라 남지 않아야 함). 리포지토리 테스트는 로컬 `hr_mate`에서 롤백 방식으로 실행(테스트 DB 분리는 5단계). Flyway 경고 `Name 'pk_employee' ignored for PRIMARY key`는 MariaDB가 기본 키 이름을 항상 PRIMARY로 쓰기 때문이며 동작 영향 없음(적용된 V1은 수정하지 않음) |
| 4 | 직원 API | 대기 | | | |
| 5 | 백엔드 자동 테스트 | 대기 | | | |
| 6 | 프론트엔드 기본 틀 | 대기 | | | |
| 7 | 직원 화면 | 대기 | | | |
| 8 | 가상 데이터, README 정리 | 대기 | | | |
| 6·7 선행 | 프론트엔드 화면 선행 (가짜 데이터): 사원 목록·등록·수정 | 완료 | 2026-09-27 | Vite 8 + React 19 + React Router 7 구성. `npm run lint`·`npm run build` 통과. 검증 규칙·가짜 API 로직 점검 31개 통과(임시 스크립트). 개발 서버 실행 후 3개 화면 표시 확인. 사용자 브라우저 동작 확인 완료 | 상세 조회·삭제 화면은 다음 작업. 자동 테스트 도구 미도입. 가짜 데이터는 새로고침 시 초기화 |
| 6·7 선행-2 | 사원 상세 조회 화면, 논리적 삭제 (가짜 데이터) | 완료 | 2026-09-27 | `npm run lint`·`npm run build` 통과. 로직 점검 41개 통과(삭제 관련 10개 추가). 헤드리스 Edge 클릭 점검 14개 통과(상세 이동, 삭제 확인창 취소·Esc·삭제, 삭제된 사원 상세·수정 차단, 삭제된 사번 재사용 차단). 사용자 브라우저 동작 확인 완료 | 자동 테스트 도구 미도입(점검 스크립트는 프로젝트 밖 임시 파일) |
