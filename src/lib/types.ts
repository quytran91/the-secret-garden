export interface ImageMeta {
  id: string
  name: string
  /** SHA-256 (hex) của nội dung file — dùng để phát hiện ảnh trùng */
  hash: string
  mime: string
  width: number
  height: number
  size: number
  createdAt: number
  favorite: boolean
}

/** Túi xáo trộn (shuffle bag) cho chế độ "Không lặp cho đến khi xem hết" */
export interface BagState {
  round: number
  /** Thứ tự các ảnh chưa mở trong vòng hiện tại (đã xáo) */
  remaining: string[]
  /** Các ảnh đã mở trong vòng hiện tại */
  drawn: string[]
}

export type DrawMode = 'bag' | 'free'
export type MotionPref = 'system' | 'reduce' | 'full'

export interface Settings {
  mode: DrawMode
  sound: boolean
  motion: MotionPref
  haptics: boolean
}

/** Lượt bốc gần nhất — được khoá ngay khi bấm, trước khi chạy hiệu ứng */
export interface CurrentDraw {
  drawId: string
  imageId: string
  at: number
  revealed: boolean
  /** Trạng thái túi trước lượt bốc, để hoàn tác nếu ảnh không mở được */
  prevBag: BagState | null
}

export interface HistoryEntry {
  /** Trùng với drawId — ghi bằng put nên không thể bị nhân đôi */
  id: string
  imageId: string
  at: number
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'bag',
  sound: false,
  motion: 'system',
  haptics: true,
}
