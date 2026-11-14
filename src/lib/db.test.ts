import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import {
  addImage,
  commitDraw,
  deleteImage,
  getDB,
  getOriginal,
  listHistory,
  loadSnapshot,
  markRevealed,
  newRound,
  rollbackDraw,
} from './db'
import type { ImageMeta } from './types'

let n = 0
const fresh = () => getDB(`test-${++n}-${Math.random()}`)

function meta(id: string, hash = `h-${id}`): ImageMeta {
  return { id, name: id, hash, mime: 'image/png', width: 10, height: 20, size: 3, createdAt: Date.now(), favorite: false }
}
const blob = (s: string) => new Blob([s], { type: 'image/png' })

async function seed(db: Awaited<ReturnType<typeof fresh>>, count: number) {
  for (let i = 0; i < count; i++) await addImage(db, meta(`img-${i}`), blob(`o${i}`), blob(`t${i}`))
}

describe('lưu trữ IndexedDB', () => {
  it('ảnh còn nguyên sau khi mở lại DB (giả lập reload)', async () => {
    const db = await fresh()
    await seed(db, 3)
    const snap = await loadSnapshot(db)
    expect(snap.images.map((i) => i.id)).toEqual(['img-0', 'img-1', 'img-2'])
    expect(snap.bag.remaining).toHaveLength(3)
    const o = await getOriginal(db, 'img-1')
    expect(o).toBeTruthy()
  })

  it('phát hiện ảnh trùng theo hash', async () => {
    const db = await fresh()
    await addImage(db, meta('a', 'same'), blob('x'), blob('y'))
    const r = await addImage(db, meta('b', 'same'), blob('x'), blob('y'))
    expect(r.status).toBe('duplicate')
    expect((await loadSnapshot(db)).images).toHaveLength(1)
  })

  it('bốc hết một vòng không lặp, lịch sử khớp kết quả', async () => {
    const db = await fresh()
    await seed(db, 5)
    const got: string[] = []
    for (let i = 0; i < 5; i++) {
      const r = await commitDraw(db, 'bag')
      expect(r.status).toBe('ok')
      if (r.status === 'ok') got.push(r.current.imageId)
    }
    expect(new Set(got).size).toBe(5)
    expect((await commitDraw(db, 'bag')).status).toBe('roundComplete')
    const hist = await listHistory(db)
    expect(hist.map((h) => h.imageId).reverse()).toEqual(got)
    await newRound(db)
    expect((await commitDraw(db, 'bag')).status).toBe('ok')
  })

  it('reload giữa lượt: kết quả còn khoá, lịch sử không nhân đôi', async () => {
    const db = await fresh()
    await seed(db, 3)
    const r = await commitDraw(db, 'bag')
    if (r.status !== 'ok') throw new Error('expected ok')
    const snap = await loadSnapshot(db)
    expect(snap.current?.drawId).toBe(r.current.drawId)
    expect(snap.current?.revealed).toBe(false)
    await markRevealed(db, r.current.drawId)
    await markRevealed(db, r.current.drawId)
    expect((await listHistory(db)).length).toBe(1)
    expect((await loadSnapshot(db)).current?.revealed).toBe(true)
  })

  it('hoàn tác khi ảnh lỗi: trả ảnh về túi, xoá lịch sử', async () => {
    const db = await fresh()
    await seed(db, 2)
    const r = await commitDraw(db, 'bag')
    if (r.status !== 'ok') throw new Error('expected ok')
    await rollbackDraw(db, r.current.drawId)
    const snap = await loadSnapshot(db)
    expect(snap.bag.remaining).toHaveLength(2)
    expect(snap.current).toBeNull()
    expect(await listHistory(db)).toHaveLength(0)
  })

  it('thêm và xoá ảnh giữa vòng', async () => {
    const db = await fresh()
    await seed(db, 3)
    const r = await commitDraw(db, 'bag')
    if (r.status !== 'ok') throw new Error('expected ok')
    await addImage(db, meta('late'), blob('l'), blob('l'))
    let snap = await loadSnapshot(db)
    expect(snap.bag.remaining).toContain('late')
    expect(snap.bag.remaining).toHaveLength(3)
    await deleteImage(db, r.current.imageId)
    snap = await loadSnapshot(db)
    expect(snap.current).toBeNull()
    expect(snap.bag.drawn).toHaveLength(0)
    expect(await listHistory(db)).toHaveLength(0)
    expect(await getOriginal(db, r.current.imageId)).toBeUndefined()
  })

  it('chế độ tự do cho phép lặp nhưng vẫn ghi lịch sử', async () => {
    const db = await fresh()
    await seed(db, 1)
    for (let i = 0; i < 3; i++) expect((await commitDraw(db, 'free')).status).toBe('ok')
    expect(await listHistory(db)).toHaveLength(3)
  })

  it('bộ sưu tập rỗng', async () => {
    const db = await fresh()
    expect((await commitDraw(db, 'bag')).status).toBe('empty')
  })
})
