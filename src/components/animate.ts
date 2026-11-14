/**
 * Hiệu ứng bốc ảnh — chạy hoàn toàn bằng DOM/canvas + requestAnimationFrame,
 * không cập nhật React state theo từng frame.
 */
import { paintMosaic, type Mosaicable } from '../lib/pixel'

export const EASE_IOS = 'cubic-bezier(0.32, 0.72, 0, 1)'
export const IDLE_COLS = 10
export const IDLE_DIM = 0.6

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
export const nextFrame = () => new Promise<number>((r) => requestAnimationFrame(r))

/** Web Animations API, sau khi xong thì ghi giá trị cuối vào style và huỷ animation. */
export async function anim(
  el: HTMLElement,
  keyframes: Keyframe[],
  duration: number,
  easing: string = EASE_IOS,
): Promise<void> {
  const a = el.animate(keyframes, { duration, easing, fill: 'forwards' })
  try {
    await a.finished
  } catch {
    /* bị huỷ */
  }
  const last = keyframes[keyframes.length - 1]
  for (const [k, v] of Object.entries(last)) {
    if (k === 'offset' || k === 'easing' || k === 'composite') continue
    ;(el.style as unknown as Record<string, string>)[k] = String(v)
  }
  a.cancel()
}

/** Cubic-bezier easing (giải theo Newton) — dùng cho vòng lướt. */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t
  const sy = (t: number) => ((ay * t + by) * t + cy) * t
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x
      const d = dx(t)
      if (Math.abs(err) < 1e-6 || Math.abs(d) < 1e-6) break
      t -= err / d
    }
    return sy(Math.min(1, Math.max(0, t)))
  }
}

/** Nhanh lúc đầu, chậm dần, dừng mềm — không vượt quá đích. */
const spinEase = bezier(0.3, 0.12, 0.08, 1)

export interface SpinCard {
  el: HTMLDivElement
  canvas: HTMLCanvasElement
}

export function buildStrip(strip: HTMLElement, count: number, w: number, h: number): SpinCard[] {
  strip.replaceChildren()
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const cards: SpinCard[] = []
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div')
    el.className = 'strip-card'
    el.style.width = `${w}px`
    el.style.height = `${h}px`
    el.style.marginLeft = `${-w / 2}px`
    el.style.marginTop = `${-h / 2}px`
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    el.appendChild(canvas)
    strip.appendChild(el)
    cards.push({ el, canvas })
  }
  return cards
}

function placeCards(cards: SpinCard[], p: number, step: number, zoom = 1) {
  for (let i = 0; i < cards.length; i++) {
    const d = i - p
    const ad = Math.abs(d)
    const el = cards[i].el
    if (ad > 3.2) {
      if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden'
      continue
    }
    if (el.style.visibility === 'hidden') el.style.visibility = ''
    const scale = (1 - Math.min(ad, 2) * 0.09) * zoom
    el.style.transform = `translate3d(${(d * step * zoom).toFixed(2)}px,0,0) scale(${scale.toFixed(4)})`
    el.style.opacity = String(Math.max(0, 1 - Math.max(0, ad - 0.6) * 0.42))
  }
}

/** Khi lướt, cả dải lùi nhẹ ra xa để thấy các card hai bên; về lại 1 trước khi dừng hẳn. */
const SPIN_ZOOM = 0.2
const smooth = (x: number) => x * x * (3 - 2 * x)
function zoomBump(t: number) {
  if (t < 0.14) return smooth(t / 0.14)
  if (t > 0.58) return 1 - smooth(Math.min(1, (t - 0.58) / 0.36))
  return 1
}

/** Cho các card lướt ngang qua giữa và dừng chính xác ở card `target`. */
export function spin(cards: SpinCard[], target: number, step: number, duration: number, alive: () => boolean) {
  return new Promise<void>((resolve) => {
    let start = 0
    placeCards(cards, 0, step)
    const frame = (now: number) => {
      if (!alive()) return resolve()
      if (!start) start = now
      const t = Math.min(1, (now - start) / duration)
      placeCards(cards, spinEase(t) * target, step, 1 - SPIN_ZOOM * zoomBump(t))
      if (t < 1) requestAnimationFrame(frame)
      else resolve()
    }
    requestAnimationFrame(frame)
  })
}

export function paintIdle(canvas: HTMLCanvasElement, m: Mosaicable, cols = IDLE_COLS, dim = IDLE_DIM) {
  paintMosaic(canvas, m, { cols, dim })
}

/** Các bước giảm kích thước ô: 12 → 24 → 48 → 96 ô theo chiều ngang. */
export const REVEAL_STEPS: { cols: number; dim: number }[] = [
  { cols: 12, dim: 0.46 },
  { cols: 24, dim: 0.32 },
  { cols: 48, dim: 0.18 },
  { cols: 96, dim: 0.07 },
]
export const REVEAL_STEP_MS = 215

/** Đợt sáng vàng ngắn + tia sáng pixel quanh khung khi ảnh mở. Nhẹ, không chớp mạnh. */
export function burst(gate: HTMLElement, reduced: boolean) {
  gate.classList.remove('is-burst', 'is-burst-soft')
  void gate.offsetWidth
  gate.classList.add(reduced ? 'is-burst-soft' : 'is-burst')
  window.setTimeout(() => gate.classList.remove('is-burst', 'is-burst-soft'), 1400)
}
