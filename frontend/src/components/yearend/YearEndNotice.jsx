/** 모든 연말정산 화면에 표시하는 모의 계산 안내 (근거: docs/tax-rules/year-end-settlement-2025.md) */
export default function YearEndNotice() {
  return (
    <div className="notice" role="note">
      <strong className="notice__title">모의 계산 · 전문가 검증 전 · 지방소득세 미포함</strong>
      <span>
        2025년 귀속 규칙(소득세법·국세청 안내)으로 계산한 포트폴리오용 결과입니다. 확정된 급여만 사용하며, 공식
        연말정산 결과가 아닙니다.
      </span>
    </div>
  )
}
