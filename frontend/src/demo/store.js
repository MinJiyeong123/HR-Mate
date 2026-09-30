// 체험 모드에서 앱 전체가 함께 쓰는 저장소 하나 (처음 사용할 때 만든다)
import { createDemoStore } from './storage.js'

let store = null

export function getDemoStore() {
  if (!store) store = createDemoStore()
  return store
}
