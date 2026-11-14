export type Rng = () => number

/** Số ngẫu nhiên [0, 1) dùng crypto — có cả trong ngữ cảnh không bảo mật */
export const cryptoRng: Rng = () => {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] / 4294967296
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID()
    } catch {
      /* ngữ cảnh không bảo mật */
    }
  }
  const buf = new Uint32Array(4)
  crypto.getRandomValues(buf)
  return Array.from(buf, (n) => n.toString(16).padStart(8, '0')).join('-')
}
