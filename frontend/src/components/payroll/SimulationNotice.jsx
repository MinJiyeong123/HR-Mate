/** 모든 급여 화면에 표시하는 시뮬레이션 안내 */
export default function SimulationNotice() {
  return (
    <div className="notice" role="note">
      <strong className="notice__title">포트폴리오용 시뮬레이션</strong>
      <span>
        급여 금액은 직접 입력한 값이며, 소득세·지방소득세·4대보험료를 자동 계산하지 않습니다. 실제 급여·세금 산출
        결과가 아닙니다.
      </span>
    </div>
  )
}
