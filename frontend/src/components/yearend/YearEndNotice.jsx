/**
 * 모든 연말정산 화면에 표시하는 모의 계산 안내
 * 근거: docs/tax-rules/year-end-settlement-2025.md, docs/tax-rules/year-end-settlement-2026.md
 */
export default function YearEndNotice() {
  return (
    <div className="notice" role="note">
      <strong className="notice__title">모의 계산 · 전문가 검증 전 · 지방소득세 미포함</strong>
      <span>
        연도별 규칙으로 계산한 포트폴리오용 결과입니다. 2025년 귀속은 소득세법·국세청 안내 기준입니다. 2026년 귀속은
        소득세법·부칙으로 확인한 범위만 반영했고, 금액 계산은 현재 2025년 귀속 규칙을 그대로 사용합니다(법령 개정 이력상
        금액 변경이 없는 것으로 추정, 금액표 원문 재확인 전, 국세청 2026년 귀속 안내 미확인). 그 밖의 연도는 2025년 귀속
        규칙으로 대체합니다. 확정된 급여만 사용하며, 공식 연말정산 결과가 아닙니다.
      </span>
    </div>
  )
}
