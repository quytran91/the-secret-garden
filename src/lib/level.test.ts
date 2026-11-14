import { describe, expect, it } from 'vitest'
import { levelFor } from './level'

describe('cấp độ', () => {
  it('bắt đầu ở LV.1', () => {
    expect(levelFor(0)).toMatchObject({ level: 1, inLevel: 0, need: 3, title: 'Người gieo hạt' })
  })
  it('lên cấp đúng ngưỡng 3, 3+5, 3+5+7', () => {
    expect(levelFor(2).level).toBe(1)
    expect(levelFor(3)).toMatchObject({ level: 2, inLevel: 0, need: 5 })
    expect(levelFor(7)).toMatchObject({ level: 2, inLevel: 4 })
    expect(levelFor(8)).toMatchObject({ level: 3, inLevel: 0, need: 7 })
    expect(levelFor(15).level).toBe(4)
  })
  it('cấp cao vẫn có danh hiệu', () => {
    expect(levelFor(500).title).toBe('Bậc thầy biết ơn')
  })
})
