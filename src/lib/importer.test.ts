import { describe, expect, it } from 'vitest'
import { detectKind, isMachineName } from './importer'

describe('tên ảnh', () => {
  it('nhận ra tên do máy tự sinh', () => {
    for (const n of ['05086DEC-13AF-43A1-90A2-B51AD10745DD', 'IMG_0123', 'IMG-20261114-WA0001', 'PXL_20261114_101010', 'Screenshot 2026-11-14', '20261114_123456', ''])
      expect(isMachineName(n), n).toBe(true)
  })
  it('giữ tên người dùng đặt', () => {
    for (const n of ['Biết ơn', 'Gia đình 2026', 'cafe tri an', 'Mong ước số 1']) expect(isMachineName(n), n).toBe(false)
  })
})

describe('định dạng', () => {
  const f = (name: string, type: string) => new File([new Uint8Array([1])], name, { type })
  it('phân loại', () => {
    expect(detectKind(f('a.jpg', 'image/jpeg'))).toBe('ok')
    expect(detectKind(f('a.HEIC', ''))).toBe('heic')
    expect(detectKind(f('a.gif', 'image/gif'))).toBe('unsupported')
    expect(detectKind(f('a.webp', ''))).toBe('ok')
  })
})
