/**
 * Cấp độ dựa trên tổng số thông điệp bạn đã thật sự đón nhận (mỗi lần ảnh hiện rõ = 1).
 * Lên LV.2 cần 3 thông điệp, mỗi cấp sau cần thêm 2 thông điệp so với cấp trước: 3, 5, 7, 9…
 */

const TITLES = [
  'Người gieo hạt',
  'Người tưới cây',
  'Người chăm vườn',
  'Người hái hoa',
  'Người giữ chìa khoá',
  'Người tìm kho báu',
  'Người giữ kho báu',
  'Người thắp sáng khu vườn',
  'Bậc thầy biết ơn',
]

export interface LevelInfo {
  level: number
  title: string
  /** Số thông điệp đã có trong cấp hiện tại */
  inLevel: number
  /** Số thông điệp cần để qua cấp hiện tại */
  need: number
  received: number
}

export const needFor = (level: number) => 3 + (level - 1) * 2

export function levelFor(received: number): LevelInfo {
  const total = Math.max(0, Math.floor(received))
  let level = 1
  let rest = total
  while (rest >= needFor(level)) {
    rest -= needFor(level)
    level++
  }
  return {
    level,
    title: TITLES[Math.min(level, TITLES.length) - 1],
    inLevel: rest,
    need: needFor(level),
    received: total,
  }
}
