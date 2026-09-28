# 급여 API 명세 (2차, 포트폴리오용 시뮬레이션)

> - 급여 금액은 사용자가 입력하고, 서버는 합계와 실지급액(지급 합계 − 공제 합계)만 계산합니다.
> - 소득세·지방소득세·4대보험료는 자동 산출하지 않습니다. 공제 항목 금액으로 직접 입력합니다.
> - 모든 금액은 시뮬레이션 값이며 실제 급여·세금 산출 결과가 아닙니다.
> - 규칙 출처: [requirements-payroll.md](../requirements-payroll.md)

- 기준 URL(로컬): `http://localhost:8080`
- 금액: 원 단위 정수 / 날짜: `"YYYY-MM-DD"` / 기간 상태: `"DRAFT"`(작성 중), `"CONFIRMED"`(확정)
- 오류 응답: 사원 API와 같은 공통 오류 형식 ([employee-api.md](employee-api.md#공통-오류-응답))

## 목록

| # | API | 설명 | 성공 | 주요 오류 |
|---|---|---|---|---|
| 1 | `GET /api/pay-items` | 지급·공제 항목 12개 (표시 순서) | 200 | |
| 2 | `GET /api/payroll-periods` | 급여 기간 목록 (최신 연월부터, 인원·합계 포함) | 200 | |
| 3 | `POST /api/payroll-periods` | 급여 기간 생성 | 201 | 400, 409 |
| 4 | `GET /api/payroll-periods/{id}` | 기간 상세 + 사원별 급여 | 200 | 404 |
| 5 | `PUT /api/payroll-periods/{id}` | 지급일 수정 (작성 중만) | 200 | 400, 404, 409 |
| 6 | `POST /api/payroll-periods/{id}/confirm` | 확정 (급여 1건 이상) | 200 | 404, 409 |
| 7 | `POST /api/payroll-periods/{id}/reopen` | 확정 취소 | 200 | 404, 409 |
| 8 | `GET /api/payroll-periods/{id}/eligible-employees` | 급여 입력 가능한 사원 | 200 | 404 |
| 9 | `POST /api/payroll-periods/{id}/payrolls` | 급여 입력 | 201 | 400, 404, 409 |
| 10 | `GET /api/payrolls/{id}` | 급여명세서 | 200 | 404 |
| 11 | `PUT /api/payrolls/{id}` | 급여 수정 (작성 중만) | 200 | 400, 404, 409 |
| 12 | `DELETE /api/payrolls/{id}` | 급여 삭제 (작성 중만, 실제 삭제) | 204 | 404, 409 |
| 13 | `GET /api/employees/{id}/payrolls?year=` | 사원별 연간 급여 내역 | 200 | 400, 404 |

## 1. 항목 목록 `GET /api/pay-items`

```json
[
  { "id": 1, "code": "BASE_SALARY", "name": "기본급", "category": "EARNING", "taxType": "TAXABLE", "sortOrder": 10 },
  { "id": 4, "code": "MEAL_ALLOWANCE", "name": "식대", "category": "EARNING", "taxType": "NON_TAXABLE", "sortOrder": 40 },
  { "id": 6, "code": "INCOME_TAX", "name": "소득세", "category": "DEDUCTION", "taxType": "NONE", "sortOrder": 110 }
]
```

- `category`: `EARNING`(지급) / `DEDUCTION`(공제)
- `taxType`: 지급 항목 `TAXABLE`(과세) / `NON_TAXABLE`(비과세), 공제 항목 `NONE`. 비과세는 분류 표시만 하며 한도는 검사하지 않습니다.
- `id`는 DB에서 정해지므로 화면은 `code`나 목록 조회 결과를 기준으로 사용합니다.

## 2. 기간 목록 `GET /api/payroll-periods` / 기간 요약 형식

```json
[
  {
    "id": 3, "year": 2026, "month": 4, "paymentDate": "2026-04-25",
    "status": "DRAFT", "confirmedAt": null,
    "payrollCount": 12, "totalEarnings": 38400000, "totalDeductions": 3100000, "totalNetPay": 35300000
  }
]
```

같은 형식이 기간 생성(3), 지급일 수정(5), 확정(6), 확정 취소(7)의 응답에도 쓰입니다.

## 3. 기간 생성 `POST /api/payroll-periods`

```json
{ "year": 2026, "month": 4, "paymentDate": "2026-04-25" }
```

- `201` + `Location: /api/payroll-periods/{id}`, 작성 중 상태, 급여 0건
- `400 INVALID_INPUT`: `fieldErrors.year`(2000~2100), `fieldErrors.month`(1~12), `fieldErrors.paymentDate`(필수)
- `409 PAYROLL_PERIOD_DUPLICATED`: 같은 연월 기간이 이미 있음

## 4. 기간 상세 `GET /api/payroll-periods/{id}`

기간 요약 형식 + `payrolls` 배열 (사번 순)

```json
{
  "id": 3, "year": 2026, "month": 4, "paymentDate": "2026-04-25", "status": "DRAFT", "confirmedAt": null,
  "payrollCount": 1, "totalEarnings": 3200000, "totalDeductions": 235000, "totalNetPay": 2965000,
  "payrolls": [
    { "id": 10, "employeeId": 2, "employeeNo": "E2019001", "employeeName": "김하늘",
      "department": "인사팀", "position": "과장",
      "totalEarnings": 3200000, "totalDeductions": 235000, "netPay": 2965000 }
  ]
}
```

- 사원 정보(사번·이름·부서·직급)는 급여 입력 당시 복사해 둔 값입니다.
- `404 PAYROLL_PERIOD_NOT_FOUND`

## 5. 지급일 수정 `PUT /api/payroll-periods/{id}`

```json
{ "paymentDate": "2026-04-24" }
```

- `200` 기간 요약. 연월은 바꿀 수 없습니다(정의되지 않은 항목은 무시).
- `400 INVALID_INPUT`, `404 PAYROLL_PERIOD_NOT_FOUND`, `409 PAYROLL_PERIOD_CONFIRMED`

## 6. 확정 `POST /api/payroll-periods/{id}/confirm` / 7. 확정 취소 `POST .../reopen`

- `200` 바뀐 상태의 기간 요약
- `404 PAYROLL_PERIOD_NOT_FOUND`
- `409 INVALID_PAYROLL_PERIOD_STATE`: 급여 0건인데 확정, 이미 확정된 기간을 확정, 작성 중인 기간을 확정 취소 (상황별 `message`)
- 확정·확정 취소 이력은 기록하지 않습니다.

## 8. 입력 가능한 사원 `GET /api/payroll-periods/{id}/eligible-employees`

```json
[ { "id": 5, "employeeNo": "E2023001", "name": "강도윤", "department": "개발팀", "position": "사원", "employmentStatus": "ACTIVE" } ]
```

- 조건: 논리 삭제되지 않음 + 해당 월 재직(입사일 ≤ 말일, 퇴사일 없음 또는 ≥ 1일) + 이 기간에 아직 급여 없음. 사번 순.
- `404 PAYROLL_PERIOD_NOT_FOUND`

## 9. 급여 입력 `POST /api/payroll-periods/{id}/payrolls`

```json
{
  "employeeId": 2,
  "lines": [
    { "payItemId": 1, "amount": 3000000 },
    { "payItemId": 4, "amount": 200000 },
    { "payItemId": 6, "amount": 100000 },
    { "payItemId": 8, "amount": 135000 }
  ],
  "memo": "4월 급여"
}
```

| 항목 | 규칙 |
|---|---|
| employeeId | 필수 |
| lines | 1~20개. 같은 항목 중복 불가, 지급 항목 금액 합계 > 0, 공제 합계 ≤ 지급 합계 |
| lines[].payItemId | 필수, 존재하는 항목 |
| lines[].amount | 필수, 0~1,000,000,000. **0원 항목은 저장하지 않음** (화면은 모든 칸을 보내도 됨) |
| memo | 200자 이하 |

- `201` + `Location: /api/payrolls/{id}`, 명세서 형식(10)
- 합계는 서버가 계산합니다. 요청에 합계를 넣어도 사용하지 않습니다.
- `400 INVALID_INPUT`: `fieldErrors.employeeId`, `fieldErrors.lines`(없는 항목·중복·지급 없음·공제 > 지급 등), `fieldErrors["lines[0].amount"]`(금액 범위), `fieldErrors.memo`
- `400 EMPLOYEE_NOT_ELIGIBLE`: 해당 월에 재직하지 않았거나 삭제된 사원
- `404 PAYROLL_PERIOD_NOT_FOUND`, `404 EMPLOYEE_NOT_FOUND`(없는 사원 ID)
- `409 PAYROLL_DUPLICATED`: 이 기간에 이미 급여가 있는 사원
- `409 PAYROLL_PERIOD_CONFIRMED`: 확정된 기간

## 10. 급여명세서 `GET /api/payrolls/{id}`

```json
{
  "id": 10,
  "period": { "id": 3, "year": 2026, "month": 4, "paymentDate": "2026-04-25", "status": "DRAFT" },
  "employeeId": 2, "employeeNo": "E2019001", "employeeName": "김하늘", "department": "인사팀", "position": "과장",
  "earnings": [
    { "payItemId": 1, "itemName": "기본급", "taxType": "TAXABLE", "amount": 3000000 },
    { "payItemId": 4, "itemName": "식대", "taxType": "NON_TAXABLE", "amount": 200000 }
  ],
  "deductions": [
    { "payItemId": 6, "itemName": "소득세", "taxType": "NONE", "amount": 100000 },
    { "payItemId": 8, "itemName": "국민연금", "taxType": "NONE", "amount": 135000 }
  ],
  "totalEarnings": 3200000, "totalDeductions": 235000, "netPay": 2965000,
  "memo": "4월 급여"
}
```

- 항목 이름·과세 구분은 입력 당시 복사해 둔 값이며, 항목 표시 순서로 정렬합니다.
- `404 PAYROLL_NOT_FOUND`

## 11. 급여 수정 `PUT /api/payrolls/{id}`

```json
{ "lines": [ { "payItemId": 1, "amount": 3100000 } ], "memo": null }
```

- 항목 전체와 메모를 보내는 전체 수정. 규칙은 급여 입력과 같습니다.
- 사원은 바꿀 수 없습니다. 본문에 `employeeId` 등 정의되지 않은 항목이 있으면 무시합니다.
- `200` 명세서 형식 / `400 INVALID_INPUT`, `404 PAYROLL_NOT_FOUND`, `409 PAYROLL_PERIOD_CONFIRMED`

## 12. 급여 삭제 `DELETE /api/payrolls/{id}`

- `204`: 작성 중인 기간의 급여를 실제로 삭제합니다(항목도 함께 삭제).
- `404 PAYROLL_NOT_FOUND`, `409 PAYROLL_PERIOD_CONFIRMED`(확정된 급여는 삭제 불가)

## 13. 사원별 연간 급여 내역 `GET /api/employees/{id}/payrolls?year=2026`

```json
[ { "payrollId": 10, "periodId": 3, "year": 2026, "month": 4, "paymentDate": "2026-04-25",
    "status": "DRAFT", "totalEarnings": 3200000, "totalDeductions": 235000, "netPay": 2965000 } ]
```

- 월 순 정렬
- `400 INVALID_INPUT`: `fieldErrors.year`(누락 또는 2000~2100 밖)
- `404 EMPLOYEE_NOT_FOUND`: 없거나 논리 삭제된 사원 (급여 기록 자체는 삭제되지 않고 기간 상세에 남음)

## 급여 오류 코드

| code | HTTP | 상황 |
|---|---|---|
| EMPLOYEE_NOT_ELIGIBLE | 400 | 해당 월에 재직하지 않았거나 삭제된 사원 |
| PAYROLL_PERIOD_NOT_FOUND | 404 | 없는 급여 기간 |
| PAYROLL_NOT_FOUND | 404 | 없는 급여 |
| PAYROLL_PERIOD_DUPLICATED | 409 | 같은 연월 기간이 이미 있음 |
| PAYROLL_DUPLICATED | 409 | 이 기간에 이미 급여가 있는 사원 |
| PAYROLL_PERIOD_CONFIRMED | 409 | 확정된 기간의 변경 요청 |
| INVALID_PAYROLL_PERIOD_STATE | 409 | 확정 조건·상태 전환 위반 |
