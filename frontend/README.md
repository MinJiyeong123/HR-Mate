# HR Mate 프론트엔드

HR Mate(인사·급여 관리 포트폴리오)의 React 화면입니다. 전체 소개, 고지 사항, 실행 순서는 [루트 README](../README.md)를 참고하세요.

## 기술

React 19, React Router 7, Vite 8, oxlint

## 명령

`frontend` 폴더에서 실행합니다.

| 명령 | 설명 |
|---|---|
| `npm install` | 라이브러리 설치 (처음 한 번) |
| `npm run dev` | 개발 서버 실행 (http://localhost:5173) |
| `npm run build` | 배포용 빌드 (`dist/`) |
| `npm run lint` | 코드 검사 (oxlint) |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm test` | 체험 모드 가짜 서버·저장 기능·연말정산 계산기 테스트 (`src/demo/**/*.test.js`, Node.js 기본 테스트) |
| `npm run dev:demo` | 체험 모드 개발 서버 (백엔드 없이 동작, CSP 없음) |
| `npm run build:demo` | 체험 모드 배포용 빌드 (`dist-demo/`, CSP 포함) |
| `npm run preview:demo` | 체험 모드 빌드 결과 미리보기 |

PowerShell에서 `npm` 실행이 막히면 `npm.cmd run dev`처럼 `npm.cmd`로 입력합니다.

## 백엔드 연결

- 화면의 `/api` 요청은 Vite 개발 서버의 프록시가 백엔드(http://localhost:8080)로 전달합니다(`vite.config.js`).
- 백엔드를 먼저 실행해야 합니다. 꺼져 있으면 화면에 "서버에 연결할 수 없습니다" 안내가 나옵니다.

## 체험 모드

- `--mode demo`로 실행·빌드하면 `vite.config.js`가 `src/api/client.js`(백엔드 요청) 대신 `src/demo/client.js`(브라우저 안 가짜 서버)를 연결합니다. 화면(`pages`)과 `api/*.js`는 그대로 씁니다.
- 데이터는 브라우저 localStorage(키 `hrmate-demo:v1`)에만 저장합니다. 주소는 `#` 방식(HashRouter)입니다.
- 체험 모드 빌드에만 CSP(`connect-src 'none'` 등)를 `<meta>`로 넣습니다. 일반 빌드에는 체험 코드와 CSP가 들어가지 않습니다.
- 연말정산 계산은 `src/demo/yearend/`(백엔드 `yearend/calculator` 의 JavaScript 이식, 저장소·네트워크를 쓰지 않는 순수 함수)가 하고, `src/demo/handlers/yearend.js` 가 저장소 읽기·쓰기와 응답 조립을 합니다.
- 사용 방법·저장·초기화·체험 가능 범위: [루트 README "체험 모드"](../README.md#체험-모드-서버db-없이-브라우저에서만)

## 폴더

```
src/
├─ api/          백엔드 API 호출 (client.js 공통, 사원·급여·연말정산)
├─ components/   공통·레이아웃·기능별 화면 조각 (common, layout, employee, payroll, yearend)
├─ pages/        화면 단위 페이지 (주소별)
├─ constants/    재직 상태·급여 상태 값
├─ utils/        입력 검증, 금액·날짜 표시 형식
└─ demo/         체험 모드 전용 (가짜 서버 router·handlers, 연말정산 계산기 yearend, localStorage 저장소, 초기 가상 데이터, 안내 띠, 테스트)
```

화면에는 가상 데이터만 입력하세요. 급여·연말정산 결과는 포트폴리오용 시뮬레이션입니다.
