import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { IconClose } from './Icons'

interface Props {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  actions?: ReactNode
  size?: 'tall' | 'auto'
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

/** Bottom sheet trên mobile, panel giữa màn hình trên desktop. Có focus trap, Esc để đóng. */
export function Sheet({ open, title, subtitle, onClose, children, actions, size = 'tall' }: Props) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const restore = useRef<HTMLElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (open) {
      restore.current = document.activeElement as HTMLElement
      setMounted(true)
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(raf)
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), 380)
    restore.current?.focus?.({ preventScroll: true })
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (shown) panel.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true })
  }, [shown])

  if (!mounted) return null

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    }
    if (e.key === 'Tab' && panel.current) {
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      )
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  return (
    <div className={`sheet-root ${shown ? 'is-open' : ''}`} onKeyDown={onKeyDown}>
      <div className="sheet-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        className={`sheet sheet-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="sheet-grabber" aria-hidden="true" />
        <header className="sheet-head">
          <div>
            <h2 id={titleId} className="title-serif sheet-title">
              {title}
            </h2>
            {subtitle && <p className="muted small">{subtitle}</p>}
          </div>
          <div className="sheet-head-actions">
            {actions}
            <button className="icon-btn" onClick={onClose} aria-label="Đóng" data-autofocus>
              <IconClose />
            </button>
          </div>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}
