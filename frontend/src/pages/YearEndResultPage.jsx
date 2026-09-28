import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getYearEndResult } from '../api/yearEndApi'
import PageHeader from '../components/layout/PageHeader'
import BalanceText from '../components/yearend/BalanceText'
import YearEndNotice from '../components/yearend/YearEndNotice'
import { formatWon } from '../utils/format'

function toErrorMessage(error) {
  return error.fieldErrors?.year ?? error.message ?? '연말정산 결과를 불러오지 못했습니다.'
}

/** 신청액 중 한도 초과로 적용되지 않은 금액 안내 */
function notAppliedNote(amount) {
  const rest = amount.requested - amount.applied
  return rest > 0 ? `신청 ${formatWon(amount.requested)} 중 ${formatWon(rest)} 한도 초과 미적용` : null
}

/** 계산표 한 줄. sign: '−' 차감 / '=' 소계 */
function Row({ step, label, detail, amount, sign, subtotal, note }) {
  return (
    <tr className={subtotal ? 'calc-table__subtotal' : undefined}>
      <td className="calc-table__step">{step}</td>
      <th scope="row">
        {label}
        {detail && <span className="calc-table__detail">{detail}</span>}
        {note && <span className="calc-table__note">{note}</span>}
      </th>
      <td className="table__number">
        {sign && <span className="calc-table__sign">{sign}</span>}
        {formatWon(amount)}
      </td>
    </tr>
  )
}

function CalculationTable({ calculation: c }) {
  const additional = c.additionalDeduction
  const additionalDetail = [
    additional.elderly > 0 && `경로우대 ${formatWon(additional.elderly)}`,
    additional.disabled > 0 && `장애인 ${formatWon(additional.disabled)}`,
    additional.woman > 0 && `부녀자 ${formatWon(additional.woman)}`,
    additional.singleParent > 0 && `한부모 ${formatWon(additional.singleParent)}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="table-wrap">
      <table className="table calc-table">
        <thead>
          <tr>
            <th scope="col">단계</th>
            <th scope="col">항목</th>
            <th scope="col" className="table__number">금액</th>
          </tr>
        </thead>
        <tbody>
          <Row step="1" label="총급여" detail="확정 급여의 과세 지급 합계" amount={c.totalSalary} />
          <Row step="2" label="근로소득공제" detail="총급여 구간별 공제, 한도 2천만원" amount={c.earnedIncomeDeduction} sign="−" />
          <Row step="" label="근로소득금액" amount={c.earnedIncomeAmount} sign="=" subtotal />
          <Row step="3" label="기본공제" detail="본인·배우자·부양가족 1명당 150만원" amount={c.basicDeduction} />
          <Row step="" label="추가공제" detail={additionalDetail || '해당 없음'} amount={additional.elderly + additional.disabled + additional.woman + additional.singleParent} />
          <Row step="" label="인적공제 적용" amount={c.personalDeduction.applied} sign="−" note={notAppliedNote(c.personalDeduction)} />
          <Row step="4" label="보험료 특별소득공제" detail="건강보험 + 장기요양보험 + 고용보험" amount={c.insuranceDeduction.applied} sign="−" note={notAppliedNote(c.insuranceDeduction)} />
          <Row step="" label="연금보험료공제" detail="국민연금" amount={c.pensionDeduction.applied} sign="−" note={notAppliedNote(c.pensionDeduction)} />
          <Row step="" label="과세표준" amount={c.taxBase} sign="=" subtotal />
          <Row step="5" label="산출세액" detail="과세표준 × 기본세율(6~45%)" amount={c.calculatedTax} subtotal />
          <Row step="6" label="근로소득세액공제" detail="한도 적용" amount={c.earnedIncomeTaxCredit} />
          <Row step="" label="자녀세액공제" amount={c.childTaxCredit} />
          <Row step="" label="출산·입양 세액공제" amount={c.birthAdoptionTaxCredit} />
          <Row step="" label="표준세액공제" detail="보험료 공제가 없을 때만 13만원" amount={c.standardTaxCredit} />
          <Row step="" label="세액공제 적용" amount={c.taxCredit.applied} sign="−" note={notAppliedNote(c.taxCredit)} />
          <Row step="" label="결정세액" amount={c.determinedTax} sign="=" subtotal />
          <Row step="7" label="기납부세액" detail="급여에서 뗀 소득세 합계" amount={c.prepaidTax} sign="−" />
        </tbody>
        <tfoot>
          <tr>
            <td />
            <th scope="row">추가 납부 / 환급</th>
            <td className="table__number">
              <BalanceText balance={c.balance} />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/** 연말정산 모의 계산 결과 (조회만) */
export default function YearEndResultPage() {
  const { employeeId } = useParams()
  const [searchParams] = useSearchParams()
  const year = searchParams.get('year') ?? String(new Date().getFullYear())
  const location = useLocation()
  const navigate = useNavigate()
  const [notice, setNotice] = useState(location.state?.notice ?? '')
  const [reloadKey, setReloadKey] = useState(0)
  const requestKey = `${employeeId}#${year}#${reloadKey}`
  const [result, setResult] = useState({ key: null, data: null, error: '' })

  useEffect(() => {
    // 새로고침했을 때 저장 완료 메시지가 다시 뜨지 않도록 주소의 상태 값을 비운다.
    if (location.state?.notice) navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
  }, [location, navigate])

  useEffect(() => {
    let ignore = false
    getYearEndResult(year, employeeId)
      .then((data) => {
        if (!ignore) setResult({ key: requestKey, data, error: '' })
      })
      .catch((error) => {
        if (!ignore) setResult({ key: requestKey, data: null, error: toErrorMessage(error) })
      })
    return () => {
      ignore = true
    }
  }, [employeeId, year, requestKey])

  const loading = result.key !== requestKey
  const data = loading ? null : result.data
  const error = loading ? '' : result.error
  const listPath = `/year-end?year=${encodeURIComponent(year)}`
  const inputPath = `/year-end/employees/${employeeId}/input?year=${encodeURIComponent(year)}`
  const breadcrumbs = [{ label: '연말정산', to: listPath }, { label: '계산 결과' }]

  if (loading || error) {
    return (
      <>
        <PageHeader breadcrumbs={breadcrumbs} title="연말정산 계산 결과" />
        <div className="card empty-state">
          <p className={error ? 'form-field__error' : undefined}>{error || '불러오는 중…'}</p>
          {error && (
            <div className="empty-state__actions">
              <button type="button" className="button button--secondary" onClick={() => setReloadKey((key) => key + 1)}>
                다시 시도
              </button>
              <Link to={listPath} className="button button--secondary">
                연말정산 목록으로
              </Link>
            </div>
          )}
        </div>
      </>
    )
  }

  const { employee, calculation } = data

  return (
    <>
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={
          <span className="page-header__title-with-badge">
            {employee.employeeName} · {data.year}년 귀속
            {employee.deleted && <span className="badge badge--deleted">삭제됨</span>}
            {employee.resigned && <span className="badge badge--resigned">퇴사</span>}
          </span>
        }
        description={`사번 ${employee.employeeNo} · ${employee.department ?? '-'} · ${employee.position ?? '-'} · 입력 자료 ${data.inputSaved ? '저장됨' : '없음(본인 기본공제만)'}`}
        actions={
          <>
            <Link to={listPath} className="button button--ghost">
              목록으로
            </Link>
            {!employee.deleted && (
              <Link to={inputPath} className="button button--primary">
                입력 자료 {data.inputSaved ? '수정' : '입력'}
              </Link>
            )}
          </>
        }
      />

      {notice && (
        <div className="alert alert--success" role="status">
          <span>{notice}</span>
          <button type="button" className="alert__close" onClick={() => setNotice('')} aria-label="알림 닫기">
            ×
          </button>
        </div>
      )}

      <YearEndNotice />

      {data.warnings.length > 0 && (
        <div className="alert alert--info yearend-warnings" role="status">
          <ul>
            {data.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {!data.calculable ? (
        <div className="card empty-state">
          <p>확정된 급여가 없어 계산할 수 없습니다.</p>
          <Link to="/payroll" className="button button--secondary">
            급여 관리로 이동
          </Link>
        </div>
      ) : (
        <>
          <div className="stats stats--four">
            <div className="stat-card">
              <span className="stat-card__label">총급여</span>
              <strong className="stat-card__value stat-card__value--money">{formatWon(calculation.totalSalary)}</strong>
              <span className="stat-card__sub">확정 급여 {data.payrollCount}개월</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">결정세액</span>
              <strong className="stat-card__value stat-card__value--money">{formatWon(calculation.determinedTax)}</strong>
            </div>
            <div className="stat-card stat-card--resigned">
              <span className="stat-card__label">기납부세액</span>
              <strong className="stat-card__value stat-card__value--money">{formatWon(calculation.prepaidTax)}</strong>
            </div>
            <div className="stat-card stat-card--active">
              <span className="stat-card__label">추가 납부 / 환급</span>
              <strong className="stat-card__value stat-card__value--money">
                <BalanceText balance={calculation.balance} />
              </strong>
              <span className="stat-card__sub">적용 규칙 {calculation.rulesYear}년 귀속</span>
            </div>
          </div>

          <section className="card">
            <div className="card__header">
              <h2 className="card__title">단계별 계산</h2>
              <span className="card__meta">원 단위 · 비율 계산의 원 미만 버림(가정)</span>
            </div>
            <CalculationTable calculation={calculation} />
          </section>

          <section className="card annual-section">
            <div className="card__header">
              <h2 className="card__title">계산에 쓴 급여 합계</h2>
              <span className="card__meta">{data.year}년 확정 급여 {data.payrollCount}개월</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  <tr><th scope="row">총급여 (과세 지급)</th><td className="table__number">{formatWon(data.sources.totalSalary)}</td></tr>
                  <tr><th scope="row">비과세 지급 (참고, 총급여에서 제외)</th><td className="table__number">{formatWon(data.sources.nonTaxableEarnings)}</td></tr>
                  <tr><th scope="row">건강보험</th><td className="table__number">{formatWon(data.sources.healthInsurance)}</td></tr>
                  <tr><th scope="row">장기요양보험</th><td className="table__number">{formatWon(data.sources.longTermCare)}</td></tr>
                  <tr><th scope="row">고용보험</th><td className="table__number">{formatWon(data.sources.employmentInsurance)}</td></tr>
                  <tr><th scope="row">국민연금</th><td className="table__number">{formatWon(data.sources.nationalPension)}</td></tr>
                  <tr><th scope="row">소득세 (기납부세액)</th><td className="table__number">{formatWon(data.sources.incomeTax)}</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <section className="card annual-section">
        <div className="card__header">
          <h2 className="card__title">가정한 계산 방식</h2>
          <span className="card__meta">공식 자료로 확인하지 못한 부분</span>
        </div>
        <ul className="yearend-assumptions">
          {data.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      </section>
    </>
  )
}
