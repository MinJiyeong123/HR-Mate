# 진행 기록

| 단계 | 내용 | 상태 | 완료일 | 확인한 내용 | 남은 문제 |
|---|---|---|---|---|---|
| 0-A | 개발 도구 준비 (VS Code) | 완료 | 2026-09-27 | VS Code 설치, 한국어 메뉴, Extension Pack for Java, Spring Boot Extension Pack 설치. VS Code 터미널에서 Java 17.0.12, Node.js v24.21.0, npm 11.19.0, Git 2.46.2 확인 | 없음 |
| 0 | 저장소 준비 (Git, .gitignore, 문서, Claude Code 읽기 차단 설정) | 완료 | 2026-09-27 | `git init -b main`, `git status`로 추적 파일 6개 확인, `git check-ignore`로 `application-local.yml`·`.env`·`.env.*`·개인 메모 제외 확인, 첫 커밋 | Claude Code 읽기 차단 설정의 실제 동작은 2단계에서 빈 테스트 파일로 검증 예정 |
| 1 | DB 준비 (hr_mate DB, 앱 전용 계정) | 보류 | | `docs/setup-database.md` 작성(미커밋). HeidiSQL·MariaDB 11.8 설치 확인. 실제 DB·계정 생성은 하지 않음 | 화면 선행 작업 후 재개 |
| 2 | 백엔드 기본 틀 | 대기 | | | |
| 3 | 직원 테이블과 엔티티 | 대기 | | | |
| 4 | 직원 API | 대기 | | | |
| 5 | 백엔드 자동 테스트 | 대기 | | | |
| 6 | 프론트엔드 기본 틀 | 대기 | | | |
| 7 | 직원 화면 | 대기 | | | |
| 8 | 가상 데이터, README 정리 | 대기 | | | |
| 6·7 선행 | 프론트엔드 화면 선행 (가짜 데이터): 사원 목록·등록·수정 | 완료 | 2026-09-27 | Vite 8 + React 19 + React Router 7 구성. `npm run lint`·`npm run build` 통과. 검증 규칙·가짜 API 로직 점검 31개 통과(임시 스크립트). 개발 서버 실행 후 3개 화면 표시 확인. 사용자 브라우저 동작 확인 완료 | 상세 조회·삭제 화면은 다음 작업. 자동 테스트 도구 미도입. 가짜 데이터는 새로고침 시 초기화 |
