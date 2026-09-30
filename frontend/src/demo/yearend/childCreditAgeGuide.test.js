// 자녀세액공제 연령 기준 안내 테스트 (실행: npm test) — 백엔드 ChildCreditAgeGuideTest 를 옮겼다.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { childCreditAgeGuide } from './childCreditAgeGuide.js'

const includesAll = (text, parts) => {
  for (const part of parts) assert.ok(text.includes(part), `"${part}" 없음: ${text}`)
}

test('2024 이하는 확인하지 않음', () => {
  const guide = childCreditAgeGuide(2024)
  assert.equal(guide.minimumAge, null)
  assert.ok(guide.basis.startsWith('이 연도의 나이 기준은 확인하지 않았습니다.'))
  includesAll(guide.basis, ['2025년 귀속 규칙으로 대체'])
  assert.equal(guide.caution, null)
})

test('2025 는 8세 이상, 주의 없음', () => {
  const guide = childCreditAgeGuide(2025)
  assert.equal(guide.minimumAge, 8)
  includesAll(guide.basis, ['2025년 귀속', '개정 전'])
  assert.equal(guide.caution, null)
})

test('2026 은 9세 이상(부칙 기준), 2017년생 주의 (법령·해석 구분, 확정 표현 없음)', () => {
  const guide = childCreditAgeGuide(2026)
  assert.equal(guide.minimumAge, 9)
  includesAll(guide.basis, ['부칙(법률 제21548호) 제2조②', '국세청 안내 미확인'])
  assert.ok(!guide.basis.includes('참고'))
  includesAll(guide.caution, ['[법령]', '제2조③', '[해석]', '공제 대상이 아닐 수 있습니다', '해석 미확정', '전문가 확인이 필요합니다', '2026년 귀속'])
})

test('2027~2029 는 부칙 연령(10·11·12세)을 참고로 표시하고 계산 대체를 알림', () => {
  for (const [year, age] of [[2027, 10], [2028, 11], [2029, 12]]) {
    const guide = childCreditAgeGuide(year)
    assert.equal(guide.minimumAge, age)
    assert.ok(guide.basis.startsWith('참고:'))
    includesAll(guide.basis, ['부칙(법률 제21548호) 제2조②', '계산은 2025년 귀속 규칙으로 대체'])
    includesAll(guide.caution, [`${year}년 귀속`, '해석 미확정'])
  }
})

test('2030 이후는 본문 13세를 참고로 표시하고 주의 없음', () => {
  for (const year of [2030, 2099]) {
    const guide = childCreditAgeGuide(year)
    assert.equal(guide.minimumAge, 13)
    assert.ok(guide.basis.startsWith('참고:'))
    includesAll(guide.basis, ['제59조의2①', '계산은 2025년 귀속 규칙으로 대체'])
    assert.equal(guide.caution, null)
  }
})
