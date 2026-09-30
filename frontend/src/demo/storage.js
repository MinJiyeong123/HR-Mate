// ------------------------------------------------------------------
// 체험 모드 저장소 (브라우저 localStorage)
// - 데이터는 이 브라우저에만 저장되며 서버로 전송되지 않는다.
// - 키 하나(hrmate-demo:v1)에 전체를 JSON 으로 저장한다. 같은 주소를 쓰는 다른 앱과 겹치지 않게 접두사를 둔다.
// - 불러오기 결과(notice):
//     first-visit  저장된 데이터가 없어 초기 데이터로 시작
//     restored     저장된 데이터를 그대로 사용
//     recovered    저장된 데이터가 손상됐거나 형식이 달라 초기 데이터로 다시 시작 (원래 값은 :broken 키에 한 번 보관)
//     memory-only  이 브라우저에서 localStorage 를 쓸 수 없어 메모리에만 보관 (새로고침하면 사라짐)
// - 브라우저가 아닌 곳(테스트)에서도 쓸 수 있도록 저장소 객체를 주입받는다.
// ------------------------------------------------------------------
import { createSeedData, SCHEMA_VERSION } from './seed.js'

export const STORAGE_KEY = `hrmate-demo:v${SCHEMA_VERSION}`
export const BROKEN_KEY = `${STORAGE_KEY}:broken`

export class DemoStorageError extends Error {
  constructor(message, cause) {
    super(message)
    this.name = 'DemoStorageError'
    this.cause = cause
  }
}

const isIdMap = (value) =>
  value !== null && typeof value === 'object' &&
  ['employee', 'payrollPeriod', 'payroll'].every((key) => Number.isInteger(value[key]) && value[key] > 0)

/** 저장된 값이 이 버전의 모양인지 검사한다. (값 하나하나의 업무 규칙은 검사하지 않는다) */
export function isValidState(state) {
  return (
    state !== null && typeof state === 'object' && !Array.isArray(state) &&
    state.schemaVersion === SCHEMA_VERSION &&
    isIdMap(state.nextIds) &&
    ['employees', 'payrollPeriods', 'payrolls', 'yearEndInputs'].every((key) => Array.isArray(state[key]))
  )
}

const clone = (value) => JSON.parse(JSON.stringify(value))

/**
 * @param {{ storage?: Storage | null, seed?: () => object }} [options]
 *   storage 를 넘기지 않으면 브라우저의 localStorage 를 쓴다(없거나 쓸 수 없으면 메모리).
 */
export function createDemoStore({ storage = defaultStorage(), seed = createSeedData } = {}) {
  let backend = storage
  let state = null
  let notice = null

  function persist(next) {
    if (!backend) return
    try {
      backend.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch (error) {
      throw new DemoStorageError('브라우저 저장 공간에 체험 데이터를 저장하지 못했습니다. 저장 공간이 부족할 수 있습니다.', error)
    }
  }

  function startFresh(nextNotice) {
    state = seed()
    notice = nextNotice
    try {
      persist(state)
    } catch {
      // 초기 데이터조차 저장하지 못하면 이 방문 동안은 메모리에만 둔다.
      backend = null
      notice = 'memory-only'
    }
  }

  function load() {
    if (state) return { notice }
    if (!backend) {
      state = seed()
      notice = 'memory-only'
      return { notice }
    }
    let raw
    try {
      raw = backend.getItem(STORAGE_KEY)
    } catch {
      backend = null
      state = seed()
      notice = 'memory-only'
      return { notice }
    }
    if (raw === null) {
      startFresh('first-visit')
      return { notice }
    }
    let parsed = null
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }
    if (isValidState(parsed)) {
      state = parsed
      notice = 'restored'
      return { notice }
    }
    // 손상됐거나 다른 버전: 원래 값을 한 번 옮겨 두고(덮어쓰지 않음) 초기 데이터로 다시 시작한다.
    try {
      if (backend.getItem(BROKEN_KEY) === null) backend.setItem(BROKEN_KEY, raw)
    } catch {
      // 보관에 실패해도 초기 데이터로 계속 진행한다.
    }
    startFresh('recovered')
    return { notice }
  }

  /** 현재 데이터의 복사본 (돌려받은 값을 바꿔도 저장소는 바뀌지 않는다) */
  function getState() {
    load()
    return clone(state)
  }

  /**
   * 데이터를 바꾸고 저장한다. mutator 는 복사본을 받아 수정한다.
   * 저장에 실패하면 DemoStorageError 를 던지고, 메모리의 데이터도 바꾸지 않는다.
   */
  function update(mutator) {
    load()
    const draft = clone(state)
    const result = mutator(draft)
    if (!isValidState(draft)) throw new DemoStorageError('체험 데이터 형식이 올바르지 않아 저장하지 않았습니다.')
    persist(draft)
    state = draft
    return result
  }

  /** 처음 상태로 되돌린다. */
  function reset() {
    if (backend) {
      try {
        backend.removeItem(STORAGE_KEY)
      } catch {
        // 지우지 못해도 아래에서 초기 데이터로 덮어쓴다.
      }
    }
    state = null
    startFresh(backend ? 'reset' : 'memory-only')
    return { notice }
  }

  return {
    load,
    getState,
    update,
    reset,
    getNotice: () => notice,
    isPersistent: () => backend !== null,
  }
}

function defaultStorage() {
  try {
    const storage = globalThis.localStorage
    if (!storage) return null
    // 일부 브라우저 설정(쿠키·사이트 데이터 차단 등)에서는 접근 자체가 예외를 낸다.
    const probe = `${STORAGE_KEY}:probe`
    storage.setItem(probe, '1')
    storage.removeItem(probe)
    return storage
  } catch {
    return null
  }
}
