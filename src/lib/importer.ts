/**
 * Nhập ảnh: kiểm tra định dạng, băm nội dung, giải mã, tạo thumbnail.
 * Xử lý tuần tự từng file để không giữ nhiều ảnh gốc trong bộ nhớ cùng lúc.
 */
import { uid } from './random'
import type { ImageMeta } from './types'

export const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_BYTES = 40 * 1024 * 1024
const THUMB_MAX = 640

export type FailReason = 'heic' | 'unsupported' | 'corrupt' | 'tooLarge' | 'quota' | 'duplicate' | 'unknown'

export const REASON_TEXT: Record<FailReason, string> = {
  heic: 'Định dạng HEIC chưa được hỗ trợ — hãy đổi sang JPEG rồi nhập lại.',
  unsupported: 'Định dạng không hỗ trợ. Chỉ nhận JPEG, PNG hoặc WebP.',
  corrupt: 'File bị hỏng hoặc không đọc được.',
  tooLarge: 'Ảnh lớn hơn 40 MB.',
  quota: 'Bộ nhớ trình duyệt đã đầy.',
  duplicate: 'Ảnh này đã có trong bộ sưu tập.',
  unknown: 'Không lưu được ảnh này.',
}

export function detectKind(file: File): 'ok' | 'heic' | 'unsupported' {
  const type = (file.type || '').toLowerCase()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (type.includes('heic') || type.includes('heif') || ext === 'heic' || ext === 'heif') return 'heic'
  if (ACCEPTED.includes(type)) return 'ok'
  if (!type && ['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'ok'
  return 'unsupported'
}

export function mimeFor(file: File): string {
  if (ACCEPTED.includes(file.type)) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase()
  return ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
}

export async function hashBytes(buf: ArrayBuffer): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', buf)
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  }
  // Dự phòng khi không có crypto.subtle (trang không chạy HTTPS): FNV-1a 2 nhánh
  const bytes = new Uint8Array(buf)
  let h1 = 0x811c9dc5
  let h2 = 0x01000193 ^ bytes.length
  for (let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i], 0x01000193)
    h2 = Math.imul(h2 ^ bytes[bytes.length - 1 - i], 0x5bd1e995)
  }
  return `fnv-${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}-${bytes.length}`
}

interface Decoded {
  source: CanvasImageSource
  width: number
  height: number
  close: () => void
}

export async function decodeBlob(blob: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob)
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() }
    } catch {
      /* thử cách dự phòng */
    }
  }
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    if (!img.naturalWidth) throw new Error('empty')
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => undefined }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), type, quality),
  )
}

export async function makeThumb(d: Decoded): Promise<Blob> {
  const scale = Math.min(1, THUMB_MAX / Math.max(d.width, d.height))
  const w = Math.max(1, Math.round(d.width * scale))
  const h = Math.max(1, Math.round(d.height * scale))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#111915'
  ctx.fillRect(0, 0, w, h)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(d.source, 0, 0, w, h)
  const blob = await canvasToBlob(c, 'image/jpeg', 0.84)
  c.width = c.height = 0
  return blob
}

export type Prepared =
  | { ok: true; meta: ImageMeta; original: Blob; thumb: Blob }
  | { ok: false; reason: FailReason }

/** Chuẩn bị một file để lưu. Không ghi DB — việc đó nằm ở tầng store. */
/** Tên file do máy tự sinh (mã UUID của iPhone, IMG_1234, ảnh chụp màn hình…) không có ý nghĩa với người dùng */
export function isMachineName(name: string): boolean {
  const n = name.trim()
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(n) ||
    /^(img|image|photo|pxl|dsc|dscn|dcim|mvimg|screenshot|ảnh)[ _-]?\d/i.test(n) ||
    /^\d{6,}([_-]\d+)*$/.test(n) ||
    n === ''
  )
}

export async function prepareFile(
  file: File,
  isDuplicate: (hash: string) => Promise<boolean>,
  fallbackName = 'Thông điệp',
): Promise<Prepared> {
  const kind = detectKind(file)
  if (kind !== 'ok') return { ok: false, reason: kind }
  if (file.size > MAX_BYTES) return { ok: false, reason: 'tooLarge' }
  if (file.size === 0) return { ok: false, reason: 'corrupt' }
  let buf: ArrayBuffer
  try {
    buf = await file.arrayBuffer()
  } catch {
    return { ok: false, reason: 'corrupt' }
  }
  const hash = await hashBytes(buf)
  if (await isDuplicate(hash)) return { ok: false, reason: 'duplicate' }
  const mime = mimeFor(file)
  const original = new Blob([buf], { type: mime })
  let decoded: Decoded
  try {
    decoded = await decodeBlob(original)
  } catch {
    return { ok: false, reason: 'corrupt' }
  }
  try {
    const thumb = await makeThumb(decoded)
    const base = file.name.replace(/\.[^.]+$/, '').trim()
    const name = isMachineName(base) ? fallbackName : base
    const meta: ImageMeta = {
      id: uid(),
      name,
      hash,
      mime,
      width: decoded.width,
      height: decoded.height,
      size: file.size,
      createdAt: Date.now(),
      favorite: false,
    }
    return { ok: true, meta, original, thumb }
  } catch {
    return { ok: false, reason: 'corrupt' }
  } finally {
    decoded.close()
  }
}
