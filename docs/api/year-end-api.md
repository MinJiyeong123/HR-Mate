# 연말정산 API 명세 (4차, 포트폴리오용 모의 계산)

> - 결과는 **모의 계산**이며 공식 연말정산 결과가 아닙니다. 세무 전문가의 검증을 받지 않았습니다.
> - 계산 규칙은 연도별입니다. 등록된 규칙은 2025·2026년 귀속이며(2026년은 법령·부칙 확인 범위만 반영, 금액 계산은 현재 2025년 귀속 규칙 사용 — 법령 개정 이력상 금액 변경이 없는 것으로 추정, 금액표 원문 재확인 전, 국세청 2026년 귀속 안내 미확인), 그 밖의 연도는 2025년 귀속 규칙으로 계산하고 경고를 함께 돌려줍니다.
> - 지방소득세는 계산하지 않습니다.
> - 규칙·계산 순서: [requirements-year-end.md](../requirements-year-end.md), 원문과 해석: [year-end-settlement-2025.md](../tax-rules/year-end-settlement-2025.md), [year-end-settlement-2026.md](../tax-rules/year-end-settlement-2026.md)

- 기준 URL(로컬): `http://localhost:8080`
- 금액: 원 단위 정수 / 연도 `{year}`: 2000~2100 (벗어나면 `400`, 숫자가 아니면 `400 fieldErrors.year`)
- 오류 응답: 공통 오류 형식 ([employee-api.md](employee-api.md#공통-오류-응답))
- 계산에는 해당 귀속연도(`pay_year`)의 **확정된 급여만** 사용합니다. 계산 결과는 저장하지 않고 조회할 때마다 계산합니다.

## 목록

| # | API | 설명 | 성공 | 주요 오류 |
|---|---|---|---|---|
| 1 | `GET /api/year-end/{year}/employees` | 그 해 확정 급여가 있는 사원 목록과 계산 요약 | 200 | 400 |
| 2 | `GET /api/year-end/{year}/employees/{id}/input` | 입력 자료 조회 (없으면 기본값) | 200 | 400, 404 |
| 3 | `PUT /api/year-end/{year}/employees/{id}/input` | 입력 자료 저장 (생성 또는 전체 교체) | 200 | 400, 404, 409 |
| 4 | `GET /api/year-end/{year}/employees/{id}/result` | 모의 계산 결과 | 200 | 400, 404 |

## 1. 목록 `GET /api/year-end/{year}/employees`

```json
[
  { "employeeId": 7, "employeeNo": "E2019001", "employeeName": "김하늘", "department": "인사팀", "position": "과장",
    "deleted": false, "resigned": false, "inputSaved": true, "payrollCount": 12,
    "totalSalary": 36000000, "determinedTax": 433500, "prepaidTax": 1000000, "balance": -566500, "rulesYear": 2025 }
]
```

- 사번 순. 사원 정보는 그 해 마지막 확정 급여에 복사해 둔 값입니다.
- `rulesYear`: 실제로 적용한 계산 규칙 연도 (등록되지 않은 연도는 2025)
- `balance` = 결정세액 − 기납부세액 (양수: 추가 납부, 음수: 환급)

## 2. 입력 조회 `GET /api/year-end/{year}/employees/{id}/input`

```json
{
  "year": 2025, "employeeId": 7, "saved": true, "editable": true,
  "spouseDeduction": true, "dependentCount": 1, "elderlyCount": 0, "disabledCount": 0,
  "womanDeduction": false, "singleParentDeduction": false, "childCreditCount": 1,
  "birthFirstCount": 0, "birthSecondCount": 0, "birthThirdPlusCount": 0,
  "updatedAt": "2026-09-28T23:10:00.123",
  "childCreditMinimumAge": 8,
  "childCreditAgeBasis": "2025년 귀속: 소득세법(2026. 4. 21. 개정 전 문구)·국세청 2025년 귀속 안내 기준 · 전문가 검증 전",
  "childCreditAgeCaution": null
}
```

- `childCreditMinimumAge`·`childCreditAgeBasis`·`childCreditAgeCaution`: 자녀세액공제 연령 **안내**(계산에 쓰지 않음). 귀속연도별 값:
  - 2024년 이하: 나이 `null`, 근거 "이 연도의 나이 기준은 확인하지 않았습니다. …"
  - 2025: 8 / 2026: 9 (부칙 제2조②, 국세청 안내 미확인) / 2027~2029: 10~12, 2030 이후: 13 (근거가 "참고:"로 시작, 계산은 2025년 규칙으로 대체)
  - `childCreditAgeCaution`: 2026~2029만 2017년생 주의 문구([법령]·[해석] 구분), 그 외 `null`
- 저장된 자료가 없으면 `saved: false`와 기본값(본인 기본공제만), `updatedAt: null`
- 논리 삭제된 사원도 조회할 수 있으며 `editable: false`
- `404 EMPLOYEE_NOT_FOUND`: 없는 사원 ID

## 3. 입력 저장 `PUT /api/year-end/{year}/employees/{id}/input`

본문은 2번 응답의 입력 항목 10개(모두 필수)입니다. 개인 식별 정보(이름·주민등록번호 등)는 받지 않습니다.

| 항목 | 규칙 |
|---|---|
| spouseDeduction, womanDeduction, singleParentDeduction | true/false |
| dependentCount | 0~20 (본인·배우자 제외) |
| elderlyCount, disabledCount | 0 이상, 기본공제 대상자 수(본인 1 + 배우자 + 부양가족) 이하 |
| childCreditCount | 0 이상, 부양가족 인원 이하 (연령 기준은 2번 응답의 연령 안내 참고, 서버는 나이를 검사하지 않음) |
| birthFirstCount, birthSecondCount | 0~1 |
| birthThirdPlusCount | 0~10 |
| (여러 항목) | 배우자 기본공제와 한부모 동시 선택 불가, 출산·입양 합계 ≤ 부양가족 |

- `200` 2번 형식
- `400 INVALID_INPUT`: 항목별 `fieldErrors.<항목>`, 여러 항목에 걸친 규칙은 `fieldErrors.input`
- `404 EMPLOYEE_NOT_FOUND`, `409 YEAR_END_INPUT_LOCKED`(논리 삭제된 사원)

## 4. 계산 결과 `GET /api/year-end/{year}/employees/{id}/result`

```json
{
  "year": 2025,
  "notice": "모의 계산 · 전문가 검증 전 · 지방소득세 미포함",
  "employee": { "employeeId": 7, "employeeNo": "E2019001", "employeeName": "김하늘", "department": "인사팀",
                "position": "과장", "deleted": false, "resigned": false },
  "calculable": true, "inputSaved": true, "payrollCount": 12, "excludedDraftPayrollCount": 0,
  "sources": { "totalSalary": 36000000, "nonTaxableEarnings": 2400000, "healthInsurance": 1300000,
               "longTermCare": 100000, "employmentInsurance": 100000, "nationalPension": 1620000, "incomeTax": 1000000 },
  "calculation": {
    "rulesYear": 2025, "totalSalary": 36000000, "earnedIncomeDeduction": 10650000, "earnedIncomeAmount": 25350000,
    "basicDeduction": 4500000,
    "additionalDeduction": { "elderly": 0, "disabled": 0, "woman": 0, "singleParent": 0 },
    "personalDeduction": { "requested": 4500000, "applied": 4500000 },
    "insuranceDeduction": { "requested": 1500000, "applied": 1500000 },
    "pensionDeduction": { "requested": 1620000, "applied": 1620000 },
    "taxBase": 17730000, "calculatedTax": 1399500,
    "earnedIncomeTaxCredit": 716000, "childTaxCredit": 250000, "birthAdoptionTaxCredit": 0, "standardTaxCredit": 0,
    "taxCredit": { "requested": 966000, "applied": 966000 },
    "determinedTax": 433500, "prepaidTax": 1000000, "balance": -566500, "additionalPayment": 0, "refund": 566500
  },
  "warnings": [],
  "assumptions": ["각 단계 비율 계산의 원 미만은 버렸습니다.", "…", "…"]
}
```

- 예시 금액은 가상 값입니다.
- `sources`: 계산에 쓴 확정 급여 합계. 총급여 = 과세 지급 합계, 보험료 공제 = 건강 + 장기요양 + 고용, 연금보험료공제 = 국민연금, 기납부세액 = 소득세
- `requested`/`applied`: 신청액과 한도 안에서 적용된 금액 (차이는 `warnings`에 안내)
- 확정 급여가 없으면 `calculable: false`, `sources`·`calculation`은 `null`, `warnings[0]` = "확정된 급여가 없어 계산할 수 없습니다."
- `warnings`: 규칙 연도 다름(등록되지 않은 연도), 2026년 귀속 확인 상태 안내, 2017년생 주의(2026~2029년 + 자녀세액공제 자녀 1명 이상 입력), 입력 자료 없음, 부녀자 공제 미적용, 한부모 우선, 공제 한도 초과, 식대 월 20만원 초과 달, 작성 중 급여 제외, 퇴사자 등
- `assumptions`: 공식 자료로 확인하지 못해 가정한 계산 방식 3개 (항상 포함)
- `404 EMPLOYEE_NOT_FOUND`: 없는 사원 ID (논리 삭제된 사원은 조회 가능, `employee.deleted: true`)

## 연말정산 오류 코드

| code | HTTP | 상황 |
|---|---|---|
| YEAR_END_INPUT_LOCKED | 409 | 논리 삭제된 사원의 입력 자료 저장 |
