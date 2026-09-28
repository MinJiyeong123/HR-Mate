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

## 백엔드 연결

- 화면의 `/api` 요청은 Vite 개발 서버의 프록시가 백엔드(http://localhost:8080)로 전달합니다(`vite.config.js`).
- 백엔드를 먼저 실행해야 합니다. 꺼져 있으면 화면에 "서버에 연결할 수 없습니다" 안내가 나옵니다.

## 폴더

```
src/
├─ api/          백엔드 API 호출 (client.js 공통, 사원·급여·연말정산)
├─ components/   공통·레이아웃·기능별 화면 조각 (common, layout, employee, payroll, yearend)
├─ pages/        화면 단위 페이지 (주소별)
├─ constants/    재직 상태·급여 상태 값
└─ utils/        입력 검증, 금액·날짜 표시 형식
```

화면에는 가상 데이터만 입력하세요. 급여·연말정산 결과는 포트폴리오용 시뮬레이션입니다.
