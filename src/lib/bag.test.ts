import { describe, expect, it } from 'vitest'
import {
  addToBag,
  createBag,
  drawNext,
  insertRandom,
  isRoundComplete,
  pickFree,
  reconcileBag,
  removeFromBag,
  shuffle,
  startNewRound,
} from './bag'

function seeded(seed = 42) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `img-${i}`)

describe('shuffle (Fisher–Yates)', () => {
  it('giữ nguyên tập phần tử', () => {
    const out = shuffle(ids(50), seeded())
    expect(out).toHaveLength(50)
    expect(new Set(out)).toEqual(new Set(ids(50)))
  })

  it('phân phối gần đều trên mọi vị trí', () => {
    const rng = seeded(7)
    const counts = [0, 0, 0, 0]
    for (let i = 0; i < 40000; i++) counts[shuffle(['a', 'b', 'c', 'd'], rng).indexOf('a')]++
    for (const c of counts) expect(Math.abs(c - 10000)).toBeLessThan(400)
  })
})

describe('shuffle bag', () => {
  it('một vòng mở mỗi ảnh đúng một lần, không lặp', () => {
    let bag = createBag(ids(12), 1, seeded())
    const seen: string[] = []
    for (;;) {
      const r = drawNext(bag)
      if (!r.imageId) break
      seen.push(r.imageId)
      bag = r.bag
    }
    expect(seen).toHaveLength(12)
    expect(new Set(seen).size).toBe(12)
    expect(isRoundComplete(bag, 12)).toBe(true)
  })

  it('vòng mới bắt đầu lại đủ ảnh', () => {
    const bag = startNewRound({ round: 1, remaining: [], drawn: ids(3) }, ids(3), seeded())
    expect(bag.round).toBe(2)
    expect(bag.remaining.sort()).toEqual(ids(3).sort())
    expect(bag.drawn).toEqual([])
  })

  it('ảnh mới thêm giữa vòng vào nhóm chưa mở', () => {
    let bag = createBag(ids(3), 1, seeded())
    bag = drawNext(bag).bag
    bag = addToBag(bag, ['new-1', 'new-2'], seeded(3))
    expect(bag.remaining).toContain('new-1')
    expect(bag.remaining).toContain('new-2')
    expect(bag.remaining).toHaveLength(4)
    expect(addToBag(bag, ['new-1'])).toBe(bag)
  })

  it('xoá ảnh loại mọi tham chiếu', () => {
    let bag = createBag(ids(4), 1, seeded())
    const first = drawNext(bag)
    bag = removeFromBag(first.bag, [first.imageId!, first.bag.remaining[0]])
    expect(bag.drawn).toEqual([])
    expect(bag.remaining).toHaveLength(2)
  })

  it('reconcile sửa id hỏng, trùng và ảnh bị thiếu', () => {
    const bag = reconcileBag({ round: 2, remaining: ['a', 'ghost', 'a'], drawn: ['b'] }, ['a', 'b', 'c'], seeded())
    expect(bag.round).toBe(2)
    expect(bag.drawn).toEqual(['b'])
    expect(bag.remaining.sort()).toEqual(['a', 'c'])
  })

  it('bộ sưu tập rỗng và chỉ một ảnh', () => {
    expect(drawNext(createBag([])).imageId).toBeNull()
    expect(isRoundComplete(createBag([]), 0)).toBe(false)
    const one = drawNext(createBag(['solo']))
    expect(one.imageId).toBe('solo')
    expect(isRoundComplete(one.bag, 1)).toBe(true)
  })

  it('insertRandom không làm mất phần tử', () => {
    expect(insertRandom(['a', 'b'], ['c', 'd'], seeded()).sort()).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('ngẫu nhiên tự do', () => {
  it('tránh lặp ngay ảnh vừa xem khi có lựa chọn khác', () => {
    const rng = seeded(9)
    for (let i = 0; i < 200; i++) expect(pickFree(['a', 'b'], 'a', rng)).toBe('b')
  })
  it('một ảnh vẫn bốc được, rỗng thì null', () => {
    expect(pickFree(['a'], 'a')).toBe('a')
    expect(pickFree([], null)).toBeNull()
  })
})
