/**
 * Mosaic "8-bit" thật: vẽ ảnh xuống độ phân giải rất thấp rồi phóng lớn với
 * image smoothing tắt. Không dùng CSS blur.
 */

export interface Mosaicable {
  /** Bản thu nhỏ trung gian (≤ 256px) — giúp màu mỗi ô là trung bình mượt */
  mid: HTMLCanvasElement
  width: number
  height: number
}

const MID_MAX = 256

/** Tạo bản trung gian một lần cho mỗi ảnh; các lần vẽ mosaic sau rất rẻ. */
export function toMosaicable(source: CanvasImageSource, width: number, height: number): Mosaicable {
  const scale = Math.min(1, MID_MAX / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))
  const mid = document.createElement('canvas')
  mid.width = w
  mid.height = h
  const ctx = mid.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  // Thu nhỏ theo 2 bước khi ảnh quá lớn để màu không bị nhiễu
  if (scale < 0.25) {
    const step = document.createElement('canvas')
    step.width = w * 4
    step.height = h * 4
    const sctx = step.getContext('2d')!
    sctx.imageSmoothingQuality = 'high'
    sctx.drawImage(source, 0, 0, step.width, step.height)
    ctx.drawImage(step, 0, 0, w, h)
    step.width = step.height = 0
  } else {
    ctx.drawImage(source, 0, 0, w, h)
  }
  return { mid, width, height }
}

let tiny: HTMLCanvasElement | null = null
function tinyCanvas(w: number, h: number) {
  if (!tiny) tiny = document.createElement('canvas')
  if (tiny.width !== w) tiny.width = w
  if (tiny.height !== h) tiny.height = h
  return tiny
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function fitRect(iw: number, ih: number, W: number, H: number, mode: 'cover' | 'contain'): Rect {
  const s = mode === 'cover' ? Math.max(W / iw, H / ih) : Math.min(W / iw, H / ih)
  const w = iw * s
  const h = ih * s
  return { x: (W - w) / 2, y: (H - h) / 2, w, h }
}

function blit(ctx: CanvasRenderingContext2D, img: Mosaicable, r: Rect, cols: number) {
  const c = Math.max(2, Math.round(cols))
  const rows = Math.max(2, Math.round((c * r.h) / r.w))
  const t = tinyCanvas(c, rows)
  const tctx = t.getContext('2d')!
  tctx.imageSmoothingEnabled = true
  tctx.imageSmoothingQuality = 'high'
  tctx.clearRect(0, 0, c, rows)
  tctx.drawImage(img.mid, 0, 0, c, rows)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(t, 0, 0, c, rows, Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h))
}

/** Đặt kích thước canvas theo kích thước hiển thị × DPR (giới hạn 2). */
export function sizeCanvas(canvas: HTMLCanvasElement) {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
}

export interface PaintOptions {
  /** Số ô theo chiều ngang của ảnh; 0 = chỉ vẽ nền ambient */
  cols: number
  /** Độ phủ lớp tối 0–1 */
  dim: number
}

/**
 * Vẽ một "card" mosaic: nền ambient (cover, rất thô, tối) + ảnh contain
 * pixel hoá ở giữa + lớp tối. Ảnh dọc, ngang, vuông đều không bị cắt.
 */
export function paintMosaic(canvas: HTMLCanvasElement, img: Mosaicable, { cols, dim }: PaintOptions) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = canvas.width
  const H = canvas.height
  ctx.fillStyle = '#0d1311'
  ctx.fillRect(0, 0, W, H)
  blit(ctx, img, fitRect(img.width, img.height, W, H, 'cover'), 5)
  ctx.fillStyle = 'rgba(8, 11, 10, 0.66)'
  ctx.fillRect(0, 0, W, H)
  if (cols > 0) blit(ctx, img, fitRect(img.width, img.height, W, H, 'contain'), cols)
  if (dim > 0) {
    ctx.fillStyle = `rgba(8, 11, 10, ${dim})`
    ctx.fillRect(0, 0, W, H)
  }
}
