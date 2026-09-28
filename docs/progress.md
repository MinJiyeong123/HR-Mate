# 진행 기록

| 단계 | 내용 | 상태 | 완료일 | 확인한 내용 | 남은 문제 |
|---|---|---|---|---|---|
| 0-A | 개발 도구 준비 (VS Code) | 완료 | 2026-09-27 | VS Code 설치, 한국어 메뉴, Extension Pack for Java, Spring Boot Extension Pack 설치. VS Code 터미널에서 Java 17.0.12, Node.js v24.21.0, npm 11.19.0, Git 2.46.2 확인 | 없음 |
| 0 | 저장소 준비 (Git, .gitignore, 문서, Claude Code 읽기 차단 설정) | 완료 | 2026-09-27 | `git init -b main`, `git status`로 추적 파일 6개 확인, `git check-ignore`로 `application-local.yml`·`.env`·`.env.*`·개인 메모 제외 확인, 첫 커밋 | Claude Code 읽기 차단 설정의 실제 동작은 2단계에서 빈 테스트 파일로 검증 예정 |
| 1 | DB 준비 (hr_mate DB, 앱 전용 계정) | 완료 | 2026-09-27 | 사용자가 HeidiSQL에서 직접 수행. MariaDB 11.8 확인, `hr_mate`(utf8mb4 / utf8mb4_unicode_ci) 생성, `hrmate_app@localhost` 생성 및 `hr_mate.*` 권한 부여(SHOW GRANTS 확인), 앱 계정 접속 시 `hr_mate`·`information_schema`만 보임. 비밀번호 입력 쿼리 탭 삭제 | 없음 |
| 2 | 백엔드 기본 틀 | 완료 | 2026-09-28 | Spring Boot 4.1.1, Java 17, Gradle 9.7.1 (Web MVC, Data JPA, Validation, MariaDB Driver, Flyway + flyway-mysql). `build -x test` 성공. Claude Code의 `application-local.yml` 읽기 차단(Read·Grep·Get-Item) 확인. `bootRun`으로 `hrmate_app` DB 연결(HikariPool Start completed), Flyway가 `flyway_schema_history` 생성, `Started HrMateApplication` 확인. `git status`에 `application-local.yml` 미표시 | 1차 실행 시 `application-local.yml`이 예상 위치에 없어 실패, 2차는 비밀번호 불일치로 실패 → 파일 재생성 및 DB 비밀번호 재설정으로 해결(처음 입력했던 탭의 위치는 미확인). 기본 테스트(`HrMateApplicationTests`)는 실제 DB에 접속하므로 테스트 DB 방식은 5단계에서 결정. 경고 2건(`WSREP_ON` 미존재, Flyway가 MariaDB 11.8 미검증)은 동작에 영향 없음 |
| 3 | 직원 테이블과 엔티티 | 완료 | 2026-09-28 | Flyway V1로 `employee` 테이블 생성(내부 ID 기본 키, 사번 UNIQUE·대문자·형식 CHECK, 재직/퇴사일 CHECK, `deleted_at` 논리 삭제). `bootRun`에서 V1 적용·Hibernate validate 통과·서버 시작 확인. `gradlew test` 22개 통과(엔티티 규칙 8, 리포지토리·DB 제약 13, 컨텍스트 1) | 테스트 후 `employee` 잔여 행이 0건인지 사용자 확인 필요(롤백 방식이라 남지 않아야 함). 리포지토리 테스트는 로컬 `hr_mate`에서 롤백 방식으로 실행(테스트 DB 분리는 5단계). Flyway 경고 `Name 'pk_employee' ignored for PRIMARY key`는 MariaDB가 기본 키 이름을 항상 PRIMARY로 쓰기 때문이며 동작 영향 없음(적용된 V1은 수정하지 않음) |
| 4 | 직원 API (+ 5단계 테스트 일부) | 완료 | 2026-09-28 | 목록·상세·등록·수정·논리삭제·사번 중복 확인 API, 공통 오류 응답(`fieldErrors` 객체). `gradlew test` 54개 통과(엔티티 8, 서비스 10, 컨트롤러 18, 리포지토리 13, API 통합 4, 컨텍스트 1). 비DB 테스트 36개는 분리 실행 후 DB 연결 로그 없음 확인. `bootRun` 후 읽기 전용 확인: 목록 0건, 테스트 사번 17개 모두 사용 가능(롤백 확인), 400 오류 응답 형식 확인. 명세 `docs/api/employee-api.md` | 프론트엔드 연결은 다음 단계. (사번 형식 오류 문구 차이는 아래 "문구 통일"에서 해결) |
| 4-연결 | 프론트엔드·백엔드 연결 | 완료 | 2026-09-28 | `employeeApi.js`를 fetch 기반 실제 API 호출로 교체(함수·ApiError 형태 유지, 명세 항목만 전송), Vite 프록시(`/api`→8080), 안내 문구 변경, 목록 오류 안내·다시 시도 추가, `mocks/mockEmployees.js` 삭제. `npm run lint`·`build` 통과. 백엔드 `gradlew test --rerun` 54개 통과. 테스트 후 읽기 전용 확인: 목록 0건, 테스트 사번 17개 사용 가능. 헤드리스 Edge 읽기 전용 점검 11개 통과(목록·중복 확인·404·400·백엔드 중지 안내). 등록·수정·퇴사/재직 정정·삭제 흐름은 사용자가 브라우저에서 확인 완료 | 등록 폼이 보내던 `employmentStatus`·`resignationDate`를 백엔드가 무시하는지(Jackson 3 설정)는 미확인 → 프론트엔드에서 명세 항목만 보내도록 처리 |
| 5 | 백엔드 자동 테스트 (테스트 DB 분리) | 완료 | 2026-09-28 | 테스트 전용 DB `hr_mate_test`·계정 `hrmate_test`(hr_mate_test 전용 권한, 사용자가 HeidiSQL로 생성). `test` 프로필(`application-test.yml` + Git 제외 `application-test-local.yml`), Gradle 테스트 프로필 고정, DB 테스트에 `@ActiveProfiles("test")`, `TestDatabaseGuardTest`(연결 DB·계정·프로필 확인). `gradlew test --rerun` 56개 통과, Flyway 로그상 `hr_mate_test`에만 V1 적용. 개발 DB 기준값(행 수/AUTO_INCREMENT/Flyway 버전) 작업 전후 0/37/1 동일, 테스트 DB 1/0 | 1차 실행은 테스트 비밀번호 파일이 없어 DB 테스트 20개가 접속 거부로 실패(개발 DB로 넘어가지 않음 확인). 작업 중 비밀번호가 Git 포함 예시 파일에 잘못 입력되어 커밋 전에 자리 표시로 되돌림 → 테스트 계정 비밀번호 변경 권장 |
| 6 | 프론트엔드 기본 틀 | 대기 | | | |
| 7 | 직원 화면 | 대기 | | | |
| 정리-1 | 사번 형식 오류 문구 통일 (백엔드) | 완료 | 2026-09-28 | 등록 API와 중복 확인 API 문구를 "사번은 공백 없이 영문·숫자 20자 이내로 입력해 주세요."로 통일(`Employee.EMPLOYEE_NO_FORMAT_MESSAGE` 한 곳에서 정의, `ValidationPatterns`가 참조). 엔티티·서비스·컨트롤러 테스트에서 문구 일치 확인. 비DB 36개, 전체 58개 통과. `bootRun` 후 중복 확인 API 응답 문구 확인(읽기 전용) | 프론트엔드의 원인별 사번 안내 문구 3개는 범위 밖으로 유지 |
| 2-1 | 급여: V2 마이그레이션과 엔티티 | 완료 | 2026-09-28 | `V2__create_payroll.sql`(pay_item·payroll_period·payroll·payroll_line, FK·UNIQUE·CHECK, 기본 항목 12개), 엔티티 7개·리포지토리 3개, 규칙 문서 `docs/requirements-payroll.md`. 비DB 테스트 51개 통과(DB 연결 로그 없음). 전체 87개 통과(급여 도메인 15, 급여 DB 14 추가). Flyway 로그상 `hr_mate_test`에만 V2 적용. 사용자 확인: 개발 DB Flyway 버전 1, 사원 12건 그대로 | 개발 DB(hr_mate)에는 미적용(2-3단계에서 승인 후). 그 전에는 bootRun 실행 시 V2가 개발 DB에 적용되므로 주의 |
| 2-2 | 급여: 서비스와 API | 완료 | 2026-09-28 | 급여 API 13개(항목·기간·확정/취소·입력 가능 사원·급여 입력/조회/수정/삭제·사원별 연간 내역), 오류 코드 7개, DTO 13개, 서비스 2개, 컨트롤러 3개, 기간별 집계 조회. 비DB 테스트 86개 통과(DB 연결 로그 없음). 전체 126개 통과(급여 서비스 19, 컨트롤러 16, 통합 4 추가). Flyway 로그상 `hr_mate_test`만 사용. 명세 `docs/api/payroll-api.md` | 개발 DB 미적용(2-3), bootRun 수동 확인은 2-3에서 |
| 8 | 가상 데이터, README 정리 | **재적용 필요** (2026-09-28 정정) | | 데모 데이터 SQL(12명: 재직 10·퇴사 2, 부서 인사2·재무2·개발3·영업2·마케팅2·미지정1, 기존 가상 데이터 8명 포함, 전화번호 없음, 이메일 example.com) 작성. `SampleDataScriptTest`로 테스트 DB에서 실행·중복 방지·규칙 통과 검증(롤백). 데모 가이드·README 작성. ~~개발 DB 반영 12건 확인, 화면 확인 12/10/2~~ → **정정:** 당시 12건은 SQL을 실행한 HeidiSQL 세션 안에서만 보인 값이었고, 사용자 추가 확인 결과 브라우저에는 사원 목록이 보이지 않았음 | 2-3단계 중 발견: 새 세션·백엔드 모두 사원 0건, AUTO_INCREMENT 37→49. 원인(추정): INSERT가 확정(커밋)되지 않은 채 세션 종료 시 롤백. 근거와 확인 불가 항목은 아래 "데모 데이터 미반영 조사" 참고. SQL 끝에 `COMMIT;` 추가, 가이드에 자동 커밋 확인·새 세션/브라우저 확인 절차 추가 |
| 6·7 선행 | 프론트엔드 화면 선행 (가짜 데이터): 사원 목록·등록·수정 | 완료 | 2026-09-27 | Vite 8 + React 19 + React Router 7 구성. `npm run lint`·`npm run build` 통과. 검증 규칙·가짜 API 로직 점검 31개 통과(임시 스크립트). 개발 서버 실행 후 3개 화면 표시 확인. 사용자 브라우저 동작 확인 완료 | 상세 조회·삭제 화면은 다음 작업. 자동 테스트 도구 미도입. 가짜 데이터는 새로고침 시 초기화 |
| 6·7 선행-2 | 사원 상세 조회 화면, 논리적 삭제 (가짜 데이터) | 완료 | 2026-09-27 | `npm run lint`·`npm run build` 통과. 로직 점검 41개 통과(삭제 관련 10개 추가). 헤드리스 Edge 클릭 점검 14개 통과(상세 이동, 삭제 확인창 취소·Esc·삭제, 삭제된 사원 상세·수정 차단, 삭제된 사번 재사용 차단). 사용자 브라우저 동작 확인 완료 | 자동 테스트 도구 미도입(점검 스크립트는 프로젝트 밖 임시 파일) |

## 데모 데이터 미반영 조사 (2026-09-28, 읽기 전용)

**증상**: 2-3단계(V2 적용) 직후 백엔드 API와 새 HeidiSQL 세션 모두 사원 0건. 직전 기존 세션 조회는 12건, AUTO_INCREMENT 49.

**확인된 사실**
- 백엔드 접속 대상은 `localhost:3306/hr_mate`(hrmate_app, local 프로필). 설정을 덮어쓰는 환경 변수 없음.
- 3306 포트의 DB 서버는 하나(mysqld). HeidiSQL과 백엔드는 같은 서버에 접속.
- V2는 Flyway 버전 1이던 `hr_mate`에 적용됨(새 세션에서 버전 2, 급여 테이블 4개, pay_item 12건 확인).
- `employee` 테이블은 다시 만들어지지 않음(V1 적용 1회, AUTO_INCREMENT 49 유지).
- 코드의 사원 삭제는 테스트 DB에서 실패하도록 만든 단일 행 DELETE 1개뿐. 8단계 이후 테스트는 모두 test 프로필(hr_mate_test).
- 사용자 기억: SQL 실행 후 HeidiSQL에는 12명이 보였으나 브라우저에는 보이지 않았음. 세션 종료 시 커밋 팝업 없음. 사원 행을 직접 수정·삭제한 적 없음.

**추정 원인**: INSERT가 확정(커밋)되지 않은 채 실행 세션 안에서만 보이다가, 세션이 닫힐 때 서버가 롤백. (AUTO_INCREMENT는 롤백되어도 되돌아가지 않음)

**추가 조회 (사용자, 조회만)**: `log_bin` OFF, `general_log` OFF, 열린 트랜잭션(`information_schema.INNODB_TRX`) 0건.
- 변경 기록 로그가 모두 꺼져 있어 **과거 INSERT·롤백·삭제를 기록으로 직접 확인할 수 없음.**
- 열린 트랜잭션 0건은 "지금 남아 있는 미확정 작업이 없다"는 뜻일 뿐, 과거에 무엇이 일어났는지를 증명하지는 않음.

**확인할 수 없는 부분**: 당시 세션의 자동 커밋 상태와 꺼진 이유(세션 종료로 확인 불가, HeidiSQL 설정은 비밀번호와 같은 곳에 저장되어 열람하지 않음), 롤백 시점, 삭제가 전혀 없었다는 증명(변경 기록 로그 OFF). `information_schema.TABLES.UPDATE_TIME`은 메모리 값이라 근거로 단정하지 않음.

**결론**: "미확정(미커밋) 상태로 세션 종료 시 롤백"은 여러 정황과 맞는 **추정**이며, 로그가 없어 **확정할 수 없음**.

**조치**: SQL 끝에 `COMMIT;` 추가(테스트는 COMMIT을 실행하지 않음), 데모 가이드에 자동 커밋 확인과 새 세션·브라우저 확인 절차 추가. 데모 데이터 재적용은 사용자 확인 후 진행.
