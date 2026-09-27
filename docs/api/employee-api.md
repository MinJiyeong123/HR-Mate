# 사원 API 명세 (1차 MVP)

- 기준 URL(로컬): `http://localhost:8080`
- 요청·응답 형식: JSON (UTF-8)
- 날짜: `"YYYY-MM-DD"` / 빈 선택 항목: `null`
- 재직 상태: `"ACTIVE"`(재직), `"RESIGNED"`(퇴사)
- 규칙 출처: [requirements-mvp1.md](../requirements-mvp1.md)
- 가상 데이터만 사용합니다. 실제 개인정보를 보내지 마세요.

## 목록

| API | 설명 | 성공 | 주요 오류 |
|---|---|---|---|
| `GET /api/employees` | 삭제되지 않은 사원 목록 (사번 순) | 200 | - |
| `GET /api/employees/{id}` | 사원 상세 | 200 | 400, 404 |
| `POST /api/employees` | 사원 등록 (재직 상태로 등록) | 201 | 400, 409 |
| `PUT /api/employees/{id}` | 사원 수정 (전체 수정, 사번 제외) | 200 | 400, 404 |
| `DELETE /api/employees/{id}` | 논리 삭제 | 204 | 404 |
| `GET /api/employees/employee-no/check?value=` | 사번 사용 가능 여부 | 200 | 400 |

`{id}`는 내부 ID(숫자)입니다. 사번이 아닙니다.

## 사원 응답 (EmployeeResponse)

```json
{
  "id": 1,
  "employeeNo": "E2026001",
  "name": "김가상",
  "department": "인사팀",
  "position": "대리",
  "phone": "010-0000-0001",
  "email": "kim@example.com",
  "hireDate": "2026-03-02",
  "employmentStatus": "ACTIVE",
  "resignationDate": null
}
```

삭제 시각 등 내부 관리 값은 응답에 포함하지 않습니다.

## 1. 목록 `GET /api/employees`

- `200`: 사원 응답 배열. 논리 삭제된 사원은 제외, 사번 오름차순. 페이지 나누기 없음.

## 2. 상세 `GET /api/employees/{id}`

- `200`: 사원 응답
- `404 EMPLOYEE_NOT_FOUND`: 없거나 논리 삭제된 사원
- `400 INVALID_INPUT`: `id`가 숫자가 아님 (`fieldErrors.id`)

## 3. 등록 `POST /api/employees`

```json
{
  "employeeNo": "e2026001",
  "name": "김가상",
  "hireDate": "2026-03-02",
  "department": "인사팀",
  "position": "대리",
  "phone": "010-0000-0001",
  "email": "kim@example.com"
}
```

| 항목 | 필수 | 규칙 |
|---|---|---|
| employeeNo | O | 영문·숫자 1~20자, 공백·특수문자 불가. 소문자는 대문자로 바꿔 저장 |
| name | O | 공백만 입력 불가, 50자 이하 |
| hireDate | O | 날짜 |
| department | | 100자 이하 |
| position | | 50자 이하 |
| phone | | `010-1234-5678`, `02-123-4567`, `031-123-4567` 형식 |
| email | | 이메일 형식, 100자 이하 |

- `201`: 등록된 사원 응답, `Location: /api/employees/{id}`. 재직 상태는 항상 `ACTIVE`.
- `400 INVALID_INPUT`: 항목별 오류는 `fieldErrors`
- `409 EMPLOYEE_NO_DUPLICATED`: 이미 사용된 사번. 논리 삭제된 사원의 사번 포함, 대소문자 차이 무시 (`fieldErrors.employeeNo`)

## 4. 수정 `PUT /api/employees/{id}`

모든 항목을 보내는 전체 수정입니다.

```json
{
  "name": "김가상",
  "hireDate": "2026-03-02",
  "department": "인사팀",
  "position": "과장",
  "phone": null,
  "email": "kim@example.com",
  "employmentStatus": "RESIGNED",
  "resignationDate": "2026-12-31"
}
```

- 사번 항목이 없으므로 사번은 바꿀 수 없습니다. 본문에 `employeeNo` 등 정의되지 않은 항목이 있으면 무시합니다.
- 필수: `name`, `hireDate`, `employmentStatus`. 나머지 항목 규칙은 등록과 같습니다.
- 재직 상태와 퇴사일 (`fieldErrors.resignationDate`로 보고)
  - `ACTIVE`: `resignationDate`는 `null`이어야 합니다. 퇴사 → 재직 정정 시 퇴사일을 비워서 보냅니다.
  - `RESIGNED`: `resignationDate` 필수, `hireDate`보다 빠를 수 없습니다.
- `200`: 수정된 사원 응답
- `400 INVALID_INPUT`, `404 EMPLOYEE_NOT_FOUND`

## 5. 논리 삭제 `DELETE /api/employees/{id}`

- `204`: 본문 없음. DB 행은 남기고 삭제 시각만 기록합니다.
- `404 EMPLOYEE_NOT_FOUND`: 없거나 이미 삭제된 사원
- 삭제된 사원은 목록·상세·수정·삭제에서 제외되지만, 사번은 계속 사용 중으로 취급합니다.

## 6. 사번 중복 확인 `GET /api/employees/employee-no/check?value=e2026001`

```json
{ "employeeNo": "E2026001", "available": false }
```

- `200`: `employeeNo`는 대문자로 바꾼 값, `available`은 사용 가능 여부 (논리 삭제된 사원의 사번은 `false`)
- `400 INVALID_INPUT`: `value` 누락 또는 형식 오류 (`fieldErrors.value`)

## 공통 오류 응답

```json
{
  "status": 400,
  "code": "INVALID_INPUT",
  "message": "입력값을 확인해 주세요.",
  "fieldErrors": { "name": "이름을 입력해 주세요." },
  "path": "/api/employees",
  "timestamp": "2026-09-28T10:15:30"
}
```

- `fieldErrors`: `{항목명: 메시지}`. 항목과 무관한 오류면 빈 객체 `{}`.
- 사용자가 입력한 값은 오류 응답에 포함하지 않습니다.

| code | HTTP | 상황 |
|---|---|---|
| INVALID_INPUT | 400 | 입력 검증 실패, 깨진 JSON, 잘못된 날짜·재직 상태 값, ID 형식 오류, 필수 파라미터 누락 |
| NOT_FOUND | 404 | 없는 API 주소 |
| EMPLOYEE_NOT_FOUND | 404 | 없거나 논리 삭제된 사원 |
| METHOD_NOT_ALLOWED | 405 | 지원하지 않는 요청 방식 |
| EMPLOYEE_NO_DUPLICATED | 409 | 사번 중복 |
| UNSUPPORTED_MEDIA_TYPE | 415 | JSON이 아닌 요청 본문 |
| INTERNAL_ERROR | 500 | 예상하지 못한 오류 (상세 원인은 서버 로그에만 기록) |

## 프론트엔드 연결 시 대응표 (아직 연결 전)

`frontend/src/api/employeeApi.js`의 함수 이름·입출력을 유지하고 내부만 아래 API 호출로 바꿉니다.

| 프론트엔드 함수 | API |
|---|---|
| `getEmployees()` | `GET /api/employees` |
| `getEmployee(id)` | `GET /api/employees/{id}` |
| `checkEmployeeNo(employeeNo)` | `GET /api/employees/employee-no/check?value=` → `{ available }` 사용 |
| `createEmployee(payload)` | `POST /api/employees` |
| `updateEmployee(id, payload)` | `PUT /api/employees/{id}` |
| `deleteEmployee(id)` | `DELETE /api/employees/{id}` |

- 오류 응답의 `status`, `message`, `fieldErrors`는 현재 가짜 API의 `ApiError(status, message, fieldErrors)`와 같은 의미입니다.
- 개발 서버 주소가 다르므로(5173 ↔ 8080) 연결 단계에서 Vite 프록시 설정이 필요합니다.
