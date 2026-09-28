import { formatWon } from '../../utils/format'

/** 결정세액 − 기납부세액: 양수 추가 납부, 음수 환급, 0 차이 없음 */
export default function BalanceText({ balance }) {
  if (balance > 0) return <span className="balance balance--pay">추가 납부 {formatWon(balance)}</span>
  if (balance < 0) return <span className="balance balance--refund">환급 {formatWon(-balance)}</span>
  return <span className="balance">차이 없음</span>
}
