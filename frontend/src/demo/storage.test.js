// 체험 모드 저장소 테스트 (실행: npm test) — 브라우저 대신 테스트용 가짜 저장소를 쓴다
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSeedData } from './seed.js'
import { BROKEN_KEY, createDemoStore, DemoStorageError, STORAGE_KEY } from './storage.js'

/** localStorage 와 같은 사용법의 가짜 저장소. fail 옵션으로 오류 상황을 흉내 낸다. */
function fakeStorage(initial = {}, fail = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem(key) {
      if (fail.get) throw new Error('getItem 실패')
      return data.has(key) ? data.get(key) : null
    },
    setItem(key, value) {
      if (fail.set) throw new Error('QuotaExceededError')
      data.set(key, String(value))
    },
    removeItem(key) {
      data.delete(key)
    },
  }
}

const saved = (storage) => JSON.parse(storage.data.get(STORAGE_KEY))

test('첫 방문: 저장된 값이 없으면 초기 데이터를 넣고 저장한다', () => {
  const storage = fakeStorage()
  const store = createDemoStore({ storage })
  assert.deepEqual(store.load(), { notice: 'first-visit' })
  assert.deepEqual(store.getState(), createSeedData())
  assert.deepEqual(saved(storage), createSeedData())
  assert.equal(store.isPersistent(), true)
})

test('저장 후 다시 불러오기(새로고침과 같음): 바꾼 내용이 유지된다', () => {
  const storage = fakeStorage()
  const first = createDemoStore({ storage })
  first.update((state) => {
    state.employees[0].name = '가상일(수정)'
    state.payrolls[1].lines[0].amount = 3_700_000
  })
  const second = createDemoStore({ storage }) // 새 페이지 로드
  assert.deepEqual(second.load(), { notice: 'restored' })
  assert.equal(second.getState().employees[0].name, '가상일(수정)')
  assert.equal(second.getState().payrolls[1].lines[0].amount, 3_700_000)
})

test('초기화: 바꾼 내용이 지워지고 처음 상태로 돌아간다 (새로 불러와도 처음 상태)', () => {
  const storage = fakeStorage()
  const store = createDemoStore({ storage })
  store.update((state) => {
    state.employees.push({ ...state.employees[0], id: 99, employeeNo: 'DEMO099' })
  })
  assert.deepEqual(store.reset(), { notice: 'reset' })
  assert.deepEqual(store.getState(), createSeedData())
  assert.deepEqual(createDemoStore({ storage }).getState(), createSeedData())
})

test('getState 는 복사본: 돌려받은 값을 바꿔도 저장소는 바뀌지 않는다', () => {
  const store = createDemoStore({ storage: fakeStorage() })
  const state = store.getState()
  state.employees.length = 0
  assert.equal(store.getState().employees.length, 8)
})

test('손상된 JSON: 원래 값을 :broken 에 보관하고 초기 데이터로 다시 시작한다', () => {
  const storage = fakeStorage({ [STORAGE_KEY]: '{깨진 값' })
  const store = createDemoStore({ storage })
  assert.deepEqual(store.load(), { notice: 'recovered' })
  assert.deepEqual(store.getState(), createSeedData())
  assert.equal(storage.data.get(BROKEN_KEY), '{깨진 값')
  assert.deepEqual(saved(storage), createSeedData())
})

test('모양이 다른 값(배열 없음·다른 버전·null·배열): 모두 초기 데이터로 다시 시작한다', () => {
  const cases = [
    JSON.stringify({ schemaVersion: 1, employees: 'x' }),
    JSON.stringify({ ...createSeedData(), schemaVersion: 2 }),
    JSON.stringify({ ...createSeedData(), nextIds: { employee: 0, payrollPeriod: 1, payroll: 1 } }),
    'null',
    '[]',
    '42',
  ]
  for (const raw of cases) {
    const storage = fakeStorage({ [STORAGE_KEY]: raw })
    const store = createDemoStore({ storage })
    assert.deepEqual(store.load(), { notice: 'recovered' }, raw)
    assert.deepEqual(store.getState(), createSeedData(), raw)
  }
})

test('이미 :broken 보관본이 있으면 덮어쓰지 않는다 (처음 손상된 값 보존)', () => {
  const storage = fakeStorage({ [STORAGE_KEY]: '두 번째 손상', [BROKEN_KEY]: '첫 번째 손상' })
  createDemoStore({ storage }).load()
  assert.equal(storage.data.get(BROKEN_KEY), '첫 번째 손상')
})

test('저장소를 쓸 수 없음(없음): 메모리에만 두고 memory-only 로 알린다', () => {
  const store = createDemoStore({ storage: null })
  assert.deepEqual(store.load(), { notice: 'memory-only' })
  assert.equal(store.isPersistent(), false)
  store.update((state) => {
    state.employees[0].name = '메모리'
  })
  assert.equal(store.getState().employees[0].name, '메모리')
  assert.deepEqual(store.reset(), { notice: 'memory-only' })
  assert.equal(store.getState().employees[0].name, '가상일')
})

test('저장소 읽기에서 오류: 메모리 모드로 계속 동작한다', () => {
  const store = createDemoStore({ storage: fakeStorage({}, { get: true }) })
  assert.deepEqual(store.load(), { notice: 'memory-only' })
  assert.equal(store.getState().employees.length, 8)
})

test('첫 방문에 저장까지 실패(용량 부족 등): 메모리 모드로 시작한다', () => {
  const store = createDemoStore({ storage: fakeStorage({}, { set: true }) })
  assert.deepEqual(store.load(), { notice: 'memory-only' })
  assert.equal(store.isPersistent(), false)
})

test('변경 저장 실패: DemoStorageError 를 던지고 메모리의 데이터도 바꾸지 않는다', () => {
  const fail = {}
  const storage = fakeStorage()
  // fail 객체를 나중에 바꿔 "처음엔 되다가 저장할 때 실패" 를 흉내 낸다.
  const flaky = { ...storage, getItem: storage.getItem, removeItem: storage.removeItem, setItem(k, v) { if (fail.set) throw new Error('QuotaExceededError'); storage.setItem(k, v) } }
  const store = createDemoStore({ storage: flaky })
  store.load()
  fail.set = true
  assert.throws(() => store.update((state) => { state.employees[0].name = '실패해야 함' }), DemoStorageError)
  assert.equal(store.getState().employees[0].name, '가상일')
})

test('변경 결과가 형식에 맞지 않으면 저장하지 않는다', () => {
  const storage = fakeStorage()
  const store = createDemoStore({ storage })
  store.load()
  assert.throws(() => store.update((state) => { delete state.payrolls }), DemoStorageError)
  assert.equal(store.getState().payrolls.length, 3)
  assert.equal(saved(storage).payrolls.length, 3)
})
