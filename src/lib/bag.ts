/**
 * Quy tắc ngẫu nhiên — hàm thuần, không phụ thuộc lưu trữ hay giao diện.
 */
import type { BagState } from './types'
import { cryptoRng, type Rng } from './random'

/** Fisher–Yates: trả về mảng mới đã xáo, mọi hoán vị đồng xác suất */
export function shuffle<T>(items: readonly T[], rng: Rng = cryptoRng): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = a[i]
    a[i] = a[j]
    a[j] = t
  }
  return a
}

export function createBag(ids: readonly string[], round = 1, rng: Rng = cryptoRng): BagState {
  return { round, remaining: shuffle(ids, rng), drawn: [] }
}

/** Chèn từng id vào vị trí ngẫu nhiên — giữ tính đồng xác suất của hoán vị */
export function insertRandom(
  remaining: readonly string[],
  ids: readonly string[],
  rng: Rng = cryptoRng,
): string[] {
  const out = remaining.slice()
  for (const id of ids) {
    const j = Math.floor(rng() * (out.length + 1))
    out.splice(j, 0, id)
  }
  return out
}

/** Thêm ảnh mới giữa vòng: ảnh mới vào nhóm chưa mở */
export function addToBag(bag: BagState, ids: readonly string[], rng: Rng = cryptoRng): BagState {
  const known = new Set([...bag.remaining, ...bag.drawn])
  const fresh = ids.filter((id) => !known.has(id))
  if (fresh.length === 0) return bag
  return { ...bag, remaining: insertRandom(bag.remaining, fresh, rng) }
}

/** Xoá ảnh: loại mọi tham chiếu */
export function removeFromBag(bag: BagState, ids: readonly string[]): BagState {
  const gone = new Set(ids)
  return {
    ...bag,
    remaining: bag.remaining.filter((id) => !gone.has(id)),
    drawn: bag.drawn.filter((id) => !gone.has(id)),
  }
}

/**
 * Đồng bộ túi với danh sách ảnh thực tế: bỏ id không còn tồn tại, bỏ trùng,
 * đưa ảnh bị thiếu vào nhóm chưa mở.
 */
export function reconcileBag(
  bag: BagState | null | undefined,
  ids: readonly string[],
  rng: Rng = cryptoRng,
): BagState {
  if (!bag) return createBag(ids, 1, rng)
  const exist = new Set(ids)
  const seen = new Set<string>()
  const keep = (id: string) => {
    if (!exist.has(id) || seen.has(id)) return false
    seen.add(id)
    return true
  }
  const drawn = bag.drawn.filter(keep)
  const remaining = bag.remaining.filter(keep)
  const missing = ids.filter((id) => !seen.has(id))
  return {
    round: bag.round,
    drawn,
    remaining: missing.length ? insertRandom(remaining, missing, rng) : remaining,
  }
}

/** Lấy ảnh kế tiếp trong túi. imageId = null nghĩa là vòng đã hết. */
export function drawNext(bag: BagState): { imageId: string | null; bag: BagState } {
  if (bag.remaining.length === 0) return { imageId: null, bag }
  const [imageId, ...rest] = bag.remaining
  return { imageId, bag: { ...bag, remaining: rest, drawn: [...bag.drawn, imageId] } }
}

export function startNewRound(bag: BagState, ids: readonly string[], rng: Rng = cryptoRng): BagState {
  return createBag(ids, bag.round + 1, rng)
}

export function isRoundComplete(bag: BagState | null, total: number): boolean {
  return !!bag && total > 0 && bag.remaining.length === 0
}

/** Ngẫu nhiên tự do (cho phép lặp), cố tránh trùng ngay ảnh vừa xem nếu có thể */
export function pickFree(ids: readonly string[], avoid: string | null, rng: Rng = cryptoRng): string | null {
  if (ids.length === 0) return null
  const pool = ids.length > 1 && avoid ? ids.filter((id) => id !== avoid) : ids
  return pool[Math.floor(rng() * pool.length)]
}
