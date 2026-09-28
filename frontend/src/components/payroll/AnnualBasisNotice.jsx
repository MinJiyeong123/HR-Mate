/**
 * 연간 급여 집계 기준 안내 (근거: docs/tax-rules/income-attribution.md)
 * excludedMessage: 합계에서 제외된 작성 중 기간·급여 안내 (없으면 표시하지 않음)
 */
export default function AnnualBasisNotice({ excludedMessage }) {
  return (
    <>
      <div className="notice" role="note">
        <strong className="notice__title">집계 기준 (전문가 검증 전)</strong>
        <span>
          귀속 연도 기준입니다. 귀속 월을 근로를 제공한 달로 간주하므로 지급일이 다음 해여도 귀속 연도에 합산합니다.
          확정된 급여 기간만 합산하며, 비과세 한도(예: 식대)는 검사하지 않습니다. 공식 원천징수·연말정산 자료가
          아닙니다.
        </span>
      </div>
      {excludedMessage && (
        <div className="alert alert--info" role="status">
          <span>{excludedMessage}</span>
        </div>
      )}
    </>
  )
}
