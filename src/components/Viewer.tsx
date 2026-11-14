import { useEffect, useRef } from 'react'
import { useBlobUrl } from '../hooks'
import { useGarden } from '../store/garden'
import { IconClose, IconHeart, IconZoomIn, IconZoomOut } from './Icons'
import { burstAt, riseFromCorner } from './fx'
import { haptic } from '../lib/feedback'

const MIN = 1
const MAX = 6

/** Xem lớn: chụm hai ngón / lăn chuột để phóng, kéo để di chuyển, chạm vào ảnh để thả tim. */
export function Viewer({ id, onClose }: { id: string; onClose: () => void }) {
  const g = useGarden()
  const meta = g.imageById.get(id)
  const { url, error } = useBlobUrl(id, 'original')
  const wrap = useRef<HTMLDivElement>(null)
  const img = useRef<HTMLImageElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const t = useRef({ s: 1, x: 0, y: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ dist: number; s: number; cx: number; cy: number; x: number; y: number } | null>(null)
  const fx = useRef<HTMLDivElement>(null)
  /** Theo dõi một lần chạm: chỉ tính là "chạm" nếu không kéo, không chụm và nhả nhanh */
  const tap = useRef<{ id: number; x: number; y: number; t: number; multi: boolean } | null>(null)

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    closeBtn.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
      prev?.focus?.({ preventScroll: true })
    }
  }, [])

  const apply = (smooth = false) => {
    const el = img.current
    const box = wrap.current
    if (!el || !box) return
    const v = t.current
    // Giới hạn kéo để ảnh không trôi khỏi khung
    const bw = box.clientWidth
    const bh = box.clientHeight
    const nw = el.naturalWidth || bw
    const nh = el.naturalHeight || bh
    const fit = Math.min(bw / nw, bh / nh)
    const iw = nw * fit * v.s
    const ih = nh * fit * v.s
    const mx = Math.max(0, (iw - bw) / 2)
    const my = Math.max(0, (ih - bh) / 2)
    v.x = Math.min(mx, Math.max(-mx, v.x))
    v.y = Math.min(my, Math.max(-my, v.y))
    el.style.transition = smooth ? 'transform 320ms cubic-bezier(0.32,0.72,0,1)' : 'none'
    el.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.s})`
  }

  const zoomAt = (ns: number, cx: number, cy: number, smooth = false) => {
    const box = wrap.current!.getBoundingClientRect()
    const v = t.current
    const s = Math.min(MAX, Math.max(MIN, ns))
    // Giữ điểm dưới ngón tay/chuột đứng yên
    const px = cx - (box.left + box.width / 2)
    const py = cy - (box.top + box.height / 2)
    v.x = px - ((px - v.x) * s) / v.s
    v.y = py - ((py - v.y) * s) / v.s
    v.s = s
    if (s === 1) {
      v.x = 0
      v.y = 0
    }
    apply(smooth)
  }

  const zoomCenter = (factor: number) => {
    const r = wrap.current!.getBoundingClientRect()
    zoomAt(t.current.s * factor, r.left + r.width / 2, r.top + r.height / 2, true)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        s: t.current.s,
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
        x: t.current.x,
        y: t.current.y,
      }
    }
    if (pointers.current.size === 1) {
      tap.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), multi: false }
    } else if (tap.current) {
      tap.current.multi = true
    }
  }

  /** Chạm vào ảnh: thả tim bay tung toé, lần đầu thì đánh dấu Yêu thích */
  const heartAt = (clientX: number, clientY: number) => {
    const layer = fx.current
    if (!layer) return
    const r = layer.getBoundingClientRect()
    const reduced = document.documentElement.classList.contains('reduce-motion')
    burstAt(layer, clientX - r.left, clientY - r.top, reduced)
    riseFromCorner(layer, 3, reduced)
    if (meta && !meta.favorite) void g.toggleFavorite(id)
    if (g.settings.haptics) haptic(8)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const cur = { x: e.clientX, y: e.clientY }
    pointers.current.set(e.pointerId, cur)
    if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const gs = gesture.current
      t.current.s = gs.s
      t.current.x = gs.x + ((a.x + b.x) / 2 - gs.cx)
      t.current.y = gs.y + ((a.y + b.y) / 2 - gs.cy)
      zoomAt((gs.s * d) / gs.dist, (a.x + b.x) / 2, (a.y + b.y) / 2)
    } else if (pointers.current.size === 1 && t.current.s > 1) {
      t.current.x += cur.x - prev.x
      t.current.y += cur.y - prev.y
      apply()
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const tp = tap.current
    if (
      e.type === 'pointerup' &&
      tp &&
      tp.id === e.pointerId &&
      !tp.multi &&
      pointers.current.size === 1 &&
      performance.now() - tp.t < 400 &&
      Math.hypot(e.clientX - tp.x, e.clientY - tp.y) < 10
    ) {
      heartAt(e.clientX, e.clientY)
    }
    if (tp?.id === e.pointerId) tap.current = null
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) gesture.current = null
    if (t.current.s < 1.02) {
      t.current = { s: 1, x: 0, y: 0 }
      apply(true)
    }
  }

  const onWheel = (e: React.WheelEvent) => {
    zoomAt(t.current.s * Math.exp(-e.deltaY * 0.0022), e.clientX, e.clientY)
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    } else if (e.key === '+' || e.key === '=') zoomCenter(1.4)
    else if (e.key === '-') zoomCenter(1 / 1.4)
    else if (e.key === '0') {
      t.current = { s: 1, x: 0, y: 0 }
      apply(true)
    } else if (t.current.s > 1 && e.key.startsWith('Arrow')) {
      e.preventDefault()
      const d = 60
      if (e.key === 'ArrowLeft') t.current.x += d
      if (e.key === 'ArrowRight') t.current.x -= d
      if (e.key === 'ArrowUp') t.current.y += d
      if (e.key === 'ArrowDown') t.current.y -= d
      apply(true)
    }
  }

  // Phím tắt nghe trên cả cửa sổ: chạm/nhấp vào ảnh làm mất focus nhưng Esc vẫn phải đóng được
  const keyRef = useRef(onKey)
  keyRef.current = onKey
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={`Xem lớn: ${meta?.name ?? 'ảnh'}`}>
      <div className="viewer-top">
        <span className="viewer-name">{meta?.name}</span>
        <div className="viewer-tools">
          {meta && (
            <button
              className={`icon-btn ${meta.favorite ? 'is-active' : ''}`}
              aria-pressed={meta.favorite}
              aria-label={meta.favorite ? 'Bỏ yêu thích' : 'Yêu thích'}
              onClick={() => g.toggleFavorite(id)}
            >
              <IconHeart filled={meta.favorite} />
            </button>
          )}
          <button className="icon-btn" aria-label="Thu nhỏ" onClick={() => zoomCenter(1 / 1.4)}>
            <IconZoomOut />
          </button>
          <button className="icon-btn" aria-label="Phóng to" onClick={() => zoomCenter(1.4)}>
            <IconZoomIn />
          </button>
          <button ref={closeBtn} className="icon-btn" aria-label="Đóng" onClick={onClose}>
            <IconClose />
          </button>
        </div>
      </div>
      <div
        ref={wrap}
        className="viewer-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {url && <img ref={img} src={url} alt={meta?.name ?? ''} draggable={false} className="viewer-img" />}
        {error && <p className="muted">Không mở được ảnh này.</p>}
      </div>
      <div ref={fx} className="fx-layer" aria-hidden="true" />
      <p className="viewer-hint small muted">
        <span className="desktop-only">Nhấp vào ảnh để thả tim · lăn chuột để phóng to · Esc để đóng</span>
        <span className="touch-only">Chạm vào ảnh để thả tim · chụm hai ngón để phóng to</span>
      </p>
    </div>
  )
}
