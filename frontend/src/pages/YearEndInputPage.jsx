import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getYearEndInput, getYearEndResult, saveYearEndInput } from '../api/yearEndApi'
import PageHeader from '../components/layout/PageHeader'
import YearEndInputForm from '../components/yearend/YearEndInputForm'
import YearEndNotice from '../components/yearend/YearEndNotice'
import { pickInput } from '../utils/yearEndValidation'

/** 연말정산 입력 자료 (저장하면 개발 DB의 year_end_input 에 기록된다) */
export default function YearEndInputPage() {
  const { employeeId } = useParams()
  const [searchParams] = useSearchParams()
  const year = searchParams.get('year') ?? String(new Date().getFullYear())
  const navigate = useNavigate()
  const [data, setData] = useState(null) // { input, employee }
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let ignore = false
    // 사원 이름 등은 계산 결과 응답의 사원 정보를 사용한다.
    Promise.all([getYearEndInput(year, employeeId), getYearEndResult(year, employeeId)])
      .then(([input, result]) => {
        if (!ignore) setData({ input, employee: result.employee })
      })
      .catch((error) => {
        if (!ignore) setLoadError(error.fieldErrors?.year ?? error.message ?? '입력 화면을 불러오지 못했습니다.')
      })
    return () => {
      ignore = true
    }
  }, [year, employeeId])

  const resultPath = `/year-end/employees/${employeeId}?year=${encodeURIComponent(year)}`
  const title = data ? `${data.employee.employeeName} · ${year}년 연말정산 입력` : '연말정산 입력'
  const header = (
    <PageHeader
      breadcrumbs={[
        { label: '연말정산', to: `/year-end?year=${encodeURIComponent(year)}` },
        { label: '계산 결과', to: resultPath },
        { label: '입력 자료' },
      ]}
      title={title}
      description="공제 대상 인원과 해당 여부만 입력합니다. 저장하면 계산 결과 화면에서 바로 확인할 수 있습니다."
    />
  )

  async function handleSubmit(values) {
    await saveYearEndInput(year, employeeId, values)
    navigate(resultPath, { state: { notice: '연말정산 입력 자료를 저장했습니다.' } })
  }

  if (loadError || !data) {
    return (
      <>
        {header}
        <div className="card empty-state">
          <p className={loadError ? 'form-field__error' : undefined}>{loadError || '불러오는 중…'}</p>
          {loadError && (
            <Link to={`/year-end?year=${encodeURIComponent(year)}`} className="button button--secondary">
              연말정산 목록으로
            </Link>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      {header}
      <YearEndNotice />
      {!data.input.editable && (
        <div className="alert alert--info" role="status">
          <span>삭제된 사원의 연말정산 자료는 수정할 수 없습니다. 조회만 가능합니다.</span>
        </div>
      )}
      <YearEndInputForm
        initialValues={pickInput(data.input)}
        readOnly={!data.input.editable}
        childAgeGuide={{
          minimumAge: data.input.childCreditMinimumAge,
          basis: data.input.childCreditAgeBasis,
          caution: data.input.childCreditAgeCaution,
        }}
        onSubmit={handleSubmit}
        onCancel={() => navigate(resultPath)}
      />
    </>
  )
}
