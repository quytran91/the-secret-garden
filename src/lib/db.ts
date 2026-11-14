/**
 * Lưu trữ cục bộ bằng IndexedDB. Ảnh gốc và thumbnail được lưu dạng Blob ở
 * hai kho riêng; metadata ở kho thứ ba để liệt kê bộ sưu tập không phải đọc ảnh.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import {
  addToBag,
  createBag,
  drawNext,
  pickFree,
  reconcileBag,
  removeFromBag,
  startNewRound,
} from './bag'
import { cryptoRng, uid, type Rng } from './random'
import { isMachineName } from './importer'
import {
  DEFAULT_SETTINGS,
  type BagState,
  type CurrentDraw,
  type DrawMode,
  type HistoryEntry,
  type ImageMeta,
  type Settings,
} from './types'

interface GardenSchema extends DBSchema {
  images: { key: string; value: ImageMeta; indexes: { hash: string } }
  originals: { key: string; value: Blob }
  thumbs: { key: string; value: Blob }
  history: { key: string; value: HistoryEntry; indexes: { imageId: string; at: number } }
  kv: { key: string; value: unknown }
}

export type GardenDB = IDBPDatabase<GardenSchema>

const DB_NAME = 'the-secret-garden'
let dbPromise: Promise<GardenDB> | null = null

export function getDB(name = DB_NAME): Promise<GardenDB> {
  if (name !== DB_NAME) return open(name)
  if (!dbPromise) dbPromise = open(name)
  return dbPromise
}

function open(name: string): Promise<GardenDB> {
  return openDB<GardenSchema>(name, 1, {
    upgrade(db) {
      const images = db.createObjectStore('images', { keyPath: 'id' })
      images.createIndex('hash', 'hash', { unique: true })
      db.createObjectStore('originals')
      db.createObjectStore('thumbs')
      const history = db.createObjectStore('history', { keyPath: 'id' })
      history.createIndex('imageId', 'imageId')
      history.createIndex('at', 'at')
      db.createObjectStore('kv')
    },
    blocking() {
      // Một tab khác cần nâng cấp — đóng để không chặn họ.
      dbPromise?.then((d) => d.close())
      dbPromise = null
    },
  })
}

export class QuotaError extends Error {
  constructor() {
    super('Bộ nhớ trình duyệt đã đầy')
    this.name = 'QuotaError'
  }
}

export function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const name = (err as { name?: string }).name
  return name === 'QuotaExceededError' || name === 'QuotaError' || (err as { code?: number }).code === 22
}

export interface Snapshot {
  images: ImageMeta[]
  bag: BagState
  settings: Settings
  current: CurrentDraw | null
}

/** Đọc toàn bộ trạng thái (trừ ảnh), đồng thời sửa các tham chiếu hỏng. */
export async function loadSnapshot(db: GardenDB, rng: Rng = cryptoRng): Promise<Snapshot> {
  const tx = db.transaction(['images', 'kv'], 'readwrite')
  const images = await tx.objectStore('images').getAll()
  const kv = tx.objectStore('kv')
  const storedBag = (await kv.get('bag')) as BagState | undefined
  const storedSettings = (await kv.get('settings')) as Partial<Settings> | undefined
  let current = ((await kv.get('current')) as CurrentDraw | undefined) ?? null
  images.sort((a, b) => a.createdAt - b.createdAt)
  for (let i = 0; i < images.length; i++) {
    if (isMachineName(images[i].name)) {
      images[i] = { ...images[i], name: `Thông điệp ${i + 1}` }
      await tx.objectStore('images').put(images[i])
    }
  }
  const ids = images.map((i) => i.id)
  const bag = reconcileBag(storedBag, ids, rng)
  await kv.put(bag, 'bag')
  if (current && !ids.includes(current.imageId)) {
    current = null
    await kv.delete('current')
  }
  await tx.done
  images.sort((a, b) => a.createdAt - b.createdAt)
  return { images, bag, settings: { ...DEFAULT_SETTINGS, ...storedSettings }, current }
}

export type AddResult =
  | { status: 'added'; meta: ImageMeta }
  | { status: 'duplicate'; existing: ImageMeta }

/** Lưu ảnh mới; kiểm tra trùng hash trong cùng giao dịch. */
export async function addImage(
  db: GardenDB,
  meta: ImageMeta,
  original: Blob,
  thumb: Blob,
  rng: Rng = cryptoRng,
): Promise<AddResult> {
  try {
    const tx = db.transaction(['images', 'originals', 'thumbs', 'kv'], 'readwrite')
    const existing = await tx.objectStore('images').index('hash').get(meta.hash)
    if (existing) {
      tx.abort()
      await tx.done.catch(() => undefined)
      return { status: 'duplicate', existing }
    }
    await tx.objectStore('originals').put(original, meta.id)
    await tx.objectStore('thumbs').put(thumb, meta.id)
    await tx.objectStore('images').put(meta)
    const kv = tx.objectStore('kv')
    const bag = (await kv.get('bag')) as BagState | undefined
    await kv.put(bag ? addToBag(bag, [meta.id], rng) : createBag([meta.id], 1, rng), 'bag')
    await tx.done
    return { status: 'added', meta }
  } catch (err) {
    if (isQuotaError(err)) throw new QuotaError()
    throw err
  }
}

export async function findByHash(db: GardenDB, hash: string): Promise<ImageMeta | undefined> {
  return db.getFromIndex('images', 'hash', hash)
}

export const getOriginal = (db: GardenDB, id: string) => db.get('originals', id)
export const getThumb = (db: GardenDB, id: string) => db.get('thumbs', id)

export async function updateMeta(db: GardenDB, id: string, patch: Partial<Pick<ImageMeta, 'name' | 'favorite'>>) {
  const tx = db.transaction('images', 'readwrite')
  const cur = await tx.store.get(id)
  if (!cur) {
    await tx.done
    return null
  }
  const next = { ...cur, ...patch }
  await tx.store.put(next)
  await tx.done
  return next
}

/** Xoá ảnh và mọi tham chiếu: túi, lịch sử, lượt bốc hiện tại. */
export async function deleteImage(db: GardenDB, id: string): Promise<BagState> {
  const tx = db.transaction(['images', 'originals', 'thumbs', 'history', 'kv'], 'readwrite')
  await tx.objectStore('images').delete(id)
  await tx.objectStore('originals').delete(id)
  await tx.objectStore('thumbs').delete(id)
  const hist = tx.objectStore('history')
  const keys = await hist.index('imageId').getAllKeys(id)
  for (const k of keys) await hist.delete(k)
  const kv = tx.objectStore('kv')
  const bag = removeFromBag(((await kv.get('bag')) as BagState | undefined) ?? createBag([]), [id])
  await kv.put(bag, 'bag')
  const current = (await kv.get('current')) as CurrentDraw | undefined
  if (current?.imageId === id) await kv.delete('current')
  await tx.done
  return bag
}

export async function clearAll(db: GardenDB) {
  const tx = db.transaction(['images', 'originals', 'thumbs', 'history', 'kv'], 'readwrite')
  await Promise.all([
    tx.objectStore('images').clear(),
    tx.objectStore('originals').clear(),
    tx.objectStore('thumbs').clear(),
    tx.objectStore('history').clear(),
    tx.objectStore('kv').clear(),
    tx.done,
  ])
}

export type DrawCommit =
  | { status: 'ok'; current: CurrentDraw; bag: BagState }
  | { status: 'empty' }
  | { status: 'roundComplete'; bag: BagState }

/**
 * Chọn và KHOÁ kết quả trước khi chạy hiệu ứng. Túi, lượt hiện tại và lịch sử
 * được ghi trong cùng một giao dịch: reload giữa hiệu ứng không làm mất kết quả
 * và không thể ghi lịch sử hai lần.
 */
export async function commitDraw(db: GardenDB, mode: DrawMode, rng: Rng = cryptoRng): Promise<DrawCommit> {
  const tx = db.transaction(['images', 'history', 'kv'], 'readwrite')
  const ids = (await tx.objectStore('images').getAllKeys()) as string[]
  const kv = tx.objectStore('kv')
  if (ids.length === 0) {
    await tx.done
    return { status: 'empty' }
  }
  const prevBag = reconcileBag((await kv.get('bag')) as BagState | undefined, ids, rng)
  const prevCurrent = (await kv.get('current')) as CurrentDraw | undefined
  let imageId: string | null
  let bag = prevBag
  if (mode === 'bag') {
    const r = drawNext(prevBag)
    if (!r.imageId) {
      await kv.put(prevBag, 'bag')
      await tx.done
      return { status: 'roundComplete', bag: prevBag }
    }
    imageId = r.imageId
    bag = r.bag
  } else {
    imageId = pickFree(ids, prevCurrent?.imageId ?? null, rng)
  }
  // Luôn tăng dần để lịch sử có thứ tự chắc chắn kể cả khi bốc trong cùng mili giây
  const at = Math.max(Date.now(), (prevCurrent?.at ?? 0) + 1)
  const current: CurrentDraw = { drawId: uid(), imageId: imageId!, at, revealed: false, prevBag }
  await kv.put(bag, 'bag')
  await kv.put(current, 'current')
  await tx.objectStore('history').put({ id: current.drawId, imageId: current.imageId, at })
  await tx.done
  return { status: 'ok', current, bag }
}

export async function markRevealed(db: GardenDB, drawId: string) {
  const tx = db.transaction('kv', 'readwrite')
  const cur = (await tx.store.get('current')) as CurrentDraw | undefined
  if (cur && cur.drawId === drawId && !cur.revealed) await tx.store.put({ ...cur, revealed: true }, 'current')
  await tx.done
}

/** Hoàn tác lượt bốc khi ảnh không mở được: trả túi và xoá lịch sử của lượt đó. */
export async function rollbackDraw(db: GardenDB, drawId: string): Promise<BagState | null> {
  const tx = db.transaction(['history', 'kv'], 'readwrite')
  const kv = tx.objectStore('kv')
  const cur = (await kv.get('current')) as CurrentDraw | undefined
  let bag: BagState | null = null
  if (cur && cur.drawId === drawId) {
    if (cur.prevBag) {
      bag = cur.prevBag
      await kv.put(bag, 'bag')
    }
    await kv.delete('current')
    await tx.objectStore('history').delete(drawId)
  }
  await tx.done
  return bag
}

export async function newRound(db: GardenDB, rng: Rng = cryptoRng): Promise<BagState> {
  const tx = db.transaction(['images', 'kv'], 'readwrite')
  const ids = (await tx.objectStore('images').getAllKeys()) as string[]
  const kv = tx.objectStore('kv')
  const old = ((await kv.get('bag')) as BagState | undefined) ?? createBag([], 0)
  const bag = startNewRound(old, ids, rng)
  await kv.put(bag, 'bag')
  await tx.done
  return bag
}

export async function saveSettings(db: GardenDB, settings: Settings) {
  await db.put('kv', settings, 'settings')
}

export async function listHistory(db: GardenDB): Promise<HistoryEntry[]> {
  const all = await db.getAllFromIndex('history', 'at')
  return all.reverse()
}
