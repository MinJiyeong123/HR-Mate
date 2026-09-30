import { useState } from 'react'
import ConfirmDialog from '../components/common/ConfirmDialog'
import { getDemoStore } from './store.js'

// 초기화 후 새로고침한 다음에도 안내를 한 번 보여 주기 위한 탭 단위 표시(sessionStorage)
const PENDING_NOTICE_KEY = 'hrmate-demo:pending-notice'

const NOTICE_MESSAGES = {
  'first-visit':
    '처음 방문하셨습니다. 가상 사원 8명과 2026년 9월 급여 기간(작성 중)으로 시작합니다. 입력한 내용은 이 브라우저에만 저장됩니다.',
  recovered: '저장된 체험 데이터를 읽을 수 없어 처음 상태로 다시 시작했습니다.',
  'memory-only': '이 브라우저에서는 체험 데이터를 저장할 수 없어, 새로고침하면 처음 상태로 돌아갑니다.',
  reset: '체험 데이터를 처음 상태로 되돌렸습니다.',
}

// StrictMode 에서 초기화 함수가 두 번 불려도 같은 값을 쓰도록 한 번만 읽는다.
let pendingNotice
function takePendingNotice() {
  if (pendingNotice === undefined) {
    pendingNotice = null
    try {
      pendingNotice = globalThis.sessionStorage?.getItem(PENDING_NOTICE_KEY) ?? null
      globalThis.sessionStorage?.removeItem(PENDING_NOTICE_KEY)
    } catch {
      pendingNotice = null
    }
  }
  return pendingNotice
}

function initialNotice() {
  const { notice } = getDemoStore().load()
  const pending = takePendingNotice()
  if (pending && NOTICE_MESSAGES[pending]) return pending
  return notice === 'restored' ? null : notice
}

/** 체험 모드 배너: 안내 문구 + 체험 데이터 초기화 버튼 + 저장소 상태 안내 */
export default function DemoBanner() {
  const [notice, setNotice] = useState(initialNotice)
  const [confirmOpen, setConfirmOpen] = useState(false)

  function handleReset() {
    const { notice: resetNotice } = getDemoStore().reset()
    try {
      globalThis.sessionStorage?.setItem(PENDING_NOTICE_KEY, resetNotice)
    } catch {
      // 안내를 넘기지 못해도 초기화는 끝났다.
    }
    // 모든 화면이 처음 상태의 데이터를 다시 읽도록 첫 화면으로 이동해 새로고침한다.
    window.location.hash = '#/employees'
    window.location.reload()
  }

  return (
    <>
      <div className="demo-banner" role="note">
        <strong>체험 모드</strong>
        <span className="demo-banner__text">
          입력한 내용은 이 브라우저에만 저장되며 서버로 전송되지 않습니다. 실제 개인정보를 입력하지 마세요.
        </span>
        <button type="button" className="button button--small demo-banner__reset" onClick={() => setConfirmOpen(true)}>
          체험 데이터 초기화
        </button>
      </div>
      {notice && NOTICE_MESSAGES[notice] && (
        <div className="demo-notice" role="status">
          <span>{NOTICE_MESSAGES[notice]}</span>
          <button type="button" className="alert__close" onClick={() => setNotice(null)} aria-label="안내 닫기">
            ×
          </button>
        </div>
      )}
      <ConfirmDialog
        open={confirmOpen}
        title="체험 데이터를 초기화할까요?"
        confirmLabel="초기화"
        tone="danger"
        onConfirm={handleReset}
        onCancel={() => setConfirmOpen(false)}
      >
        <p>입력하거나 수정한 체험 데이터가 모두 지워지고 처음 상태(가상 사원 8명, 2026년 9월 급여 기간)로 돌아갑니다.</p>
        <p>이 브라우저에 저장된 체험 데이터에만 적용되며, 되돌릴 수 없습니다.</p>
      </ConfirmDialog>
    </>
  )
}
