/**
 * Nạp ảnh từ IndexedDB cho giao diện. Thumbnail mosaic được cache (rất nhỏ);
 * ảnh gốc chỉ nạp từng ảnh một và người gọi chịu trách nhiệm revoke URL.
 */
import { getDB, getOriginal, getThumb } from './db'
import { decodeBlob } from './importer'
import { toMosaicable, type Mosaicable } from './pixel'

const mosaicCache = new Map<string, Promise<Mosaicable>>()

export function thumbMosaic(id: string): Promise<Mosaicable> {
  let p = mosaicCache.get(id)
  if (!p) {
    p = (async () => {
      const blob = await getThumb(await getDB(), id)
      if (!blob) throw new Error('missing-thumb')
      const d = await decodeBlob(blob)
      try {
        return toMosaicable(d.source, d.width, d.height)
      } finally {
        d.close()
      }
    })()
    p.catch(() => mosaicCache.delete(id))
    mosaicCache.set(id, p)
  }
  return p
}

export function forgetMosaics(keep: Set<string>) {
  for (const id of mosaicCache.keys()) if (!keep.has(id)) mosaicCache.delete(id)
}

export interface LoadedOriginal {
  id: string
  url: string
  mosaic: Mosaicable
  width: number
  height: number
}

/** Nạp và giải mã sẵn ảnh gốc trước khi reveal để không bao giờ hiện khung trống. */
export async function loadOriginal(id: string, timeoutMs = 12000): Promise<LoadedOriginal> {
  const work = (async () => {
    const blob = await getOriginal(await getDB(), id)
    if (!blob) throw new Error('missing-original')
    const url = URL.createObjectURL(blob)
    try {
      const img = new Image()
      img.decoding = 'async'
      img.src = url
      await img.decode()
      if (!img.naturalWidth) throw new Error('decode')
      const mosaic = toMosaicable(img, img.naturalWidth, img.naturalHeight)
      return { id, url, mosaic, width: img.naturalWidth, height: img.naturalHeight }
    } catch (err) {
      URL.revokeObjectURL(url)
      throw err
    }
  })()
  let timer = 0
  let timedOut = false
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => {
      timedOut = true
      reject(new Error('timeout'))
    }, timeoutMs)
  })
  // Nếu hết giờ mà sau đó vẫn nạp xong, giải phóng URL thừa
  work.then((r) => timedOut && URL.revokeObjectURL(r.url), () => undefined)
  try {
    return await Promise.race([work, timeout])
  } finally {
    clearTimeout(timer)
  }
}
