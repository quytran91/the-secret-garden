import { useEffect, useRef } from 'react'

export interface ConfirmRequest {
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void | Promise<void>
}

export function Confirm({ req, onClose }: { req: ConfirmRequest | null; onClose: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!req) return
    const prev = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()
    return () => prev?.focus?.({ preventScroll: true })
  }, [req])
  if (!req) return null
  return (
    <div
      className="confirm-root"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
      }}
    >
      <div className="sheet-scrim is-solid" onClick={onClose} aria-hidden="true" />
      <div className="confirm" role="alertdialog" aria-modal="true" aria-labelledby="cf-t" aria-describedby="cf-b">
        <h2 id="cf-t" className="title-serif">
          {req.title}
        </h2>
        <p id="cf-b" className="muted">
          {req.body}
        </p>
        <div className="confirm-actions">
          <button ref={cancelRef} className="btn btn-ghost" onClick={onClose}>
            Giữ lại
          </button>
          <button
            className="btn btn-danger"
            onClick={async () => {
              await req.onConfirm()
              onClose()
            }}
          >
            {req.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
