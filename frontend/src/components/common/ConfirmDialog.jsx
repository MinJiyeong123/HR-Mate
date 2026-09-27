import { useEffect, useRef } from 'react'

/**
 * 확인 대화상자 (브라우저 기본 <dialog> 사용: Esc 닫기·포커스 가두기 지원)
 * - open: 열림 여부
 * - tone: 'danger'이면 확인 버튼을 빨간색으로 표시
 * - busy: 처리 중에는 버튼을 비활성화하고 닫히지 않게 한다
 */
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = '확인',
  cancelLabel = '취소',
  tone = 'default',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  function handleCancel(event) {
    // Esc 키로 닫을 때도 부모 상태와 맞춘다.
    event.preventDefault()
    if (!busy) onCancel()
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby="confirm-dialog-title"
      onCancel={handleCancel}
    >
      <h2 id="confirm-dialog-title" className="dialog__title">
        {title}
      </h2>
      <div className="dialog__body">{children}</div>
      <div className="dialog__actions">
        <button type="button" className="button button--ghost" onClick={onCancel} disabled={busy} autoFocus>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`button ${tone === 'danger' ? 'button--danger' : 'button--primary'}`}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? '처리 중…' : confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
