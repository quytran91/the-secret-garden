/**
 * Hiệu ứng "thả tim" kiểu livestream: emoji bắn tung toé quanh ngón tay + dòng tim bay lên ở góc.
 * Chạy bằng Web Animations API trên các span tạm thời, không cập nhật React state.
 * Emoji dùng font màu của hệ thống — trên iPhone là emoji Apple.
 */

const SPRAY = ['❤️', '💖', '💗', '💕', '💞', '✨', '🥰', '😍', '💎', '🌸', '🌟', '🎉', '🫶', '🌈']
const RISE = ['❤️', '💖', '💗', '💕', '💜', '💙', '🧡', '💛', '🥰', '✨']
const MAX_LIVE = 160

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

function spawn(layer: HTMLElement, char: string, x: number, y: number, size: number) {
  if (layer.childElementCount > MAX_LIVE) layer.firstElementChild?.remove()
  const el = document.createElement('span')
  el.className = 'fx-emoji'
  el.textContent = char
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  el.style.fontSize = `${size}px`
  layer.appendChild(el)
  return el
}

function run(el: HTMLElement, keyframes: Keyframe[], duration: number, easing: string, delay = 0) {
  const a = el.animate(keyframes, { duration, easing, delay, fill: 'both' })
  a.onfinish = () => el.remove()
  a.oncancel = () => el.remove()
}

/** Bắn emoji tung toé từ điểm chạm (toạ độ theo layer). */
export function burstAt(layer: HTMLElement, x: number, y: number, reduced = false) {
  // Trái tim lớn bật lên ngay dưới ngón tay
  const big = spawn(layer, '❤️', x, y, reduced ? 56 : 84)
  run(
    big,
    reduced
      ? [
          { transform: 'translate(-50%, -50%) scale(0.8)', opacity: 0 },
          { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.3 },
          { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 },
        ]
      : [
          { transform: `translate(-50%, -50%) scale(0.2) rotate(${rand(-20, 20)}deg)`, opacity: 0 },
          { transform: 'translate(-50%, -50%) scale(1.25) rotate(0deg)', opacity: 1, offset: 0.25 },
          { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.45 },
          { transform: 'translate(-50%, -160%) scale(0.9)', opacity: 0 },
        ],
    reduced ? 600 : 900,
    'cubic-bezier(0.22, 1, 0.36, 1)',
  )
  if (reduced) return

  // Emoji văng ra theo đường cong rồi rơi nhẹ
  const n = Math.round(rand(10, 15))
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n + rand(-0.35, 0.35)
    const dist = rand(70, 170)
    const dx = Math.cos(angle) * dist
    const dy = Math.sin(angle) * dist - rand(30, 80)
    const fall = rand(60, 140)
    const spin = rand(-260, 260)
    const size = rand(22, 40)
    const el = spawn(layer, pick(SPRAY), x, y, size)
    run(
      el,
      [
        { transform: 'translate(-50%, -50%) scale(0.3) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.1) rotate(${spin * 0.6}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${dx * 1.15}px), calc(-50% + ${dy + fall}px)) scale(0.8) rotate(${spin}deg)`, opacity: 0 },
      ],
      rand(900, 1400),
      'cubic-bezier(0.2, 0.8, 0.3, 1)',
      rand(0, 60),
    )
  }
}

/** Dòng tim bay lên lượn sóng ở góc dưới bên phải, như livestream. */
export function riseFromCorner(layer: HTMLElement, count = 3, reduced = false) {
  if (reduced) return
  const w = layer.clientWidth
  const h = layer.clientHeight
  for (let i = 0; i < count; i++) {
    const startX = w - rand(36, 70)
    const startY = h - rand(40, 70)
    const el = spawn(layer, pick(RISE), startX, startY, rand(24, 36))
    const height = rand(h * 0.45, h * 0.75)
    const sway = rand(18, 40) * (Math.random() < 0.5 ? -1 : 1)
    run(
      el,
      [
        { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0 },
        { transform: `translate(calc(-50% + ${sway}px), calc(-50% - ${height * 0.3}px)) scale(1.05)`, opacity: 1, offset: 0.25 },
        { transform: `translate(calc(-50% - ${sway}px), calc(-50% - ${height * 0.65}px)) scale(1)`, opacity: 0.9, offset: 0.6 },
        { transform: `translate(calc(-50% + ${sway * 0.5}px), calc(-50% - ${height}px)) scale(0.9)`, opacity: 0 },
      ],
      rand(1800, 2600),
      'linear',
      i * rand(90, 160),
    )
  }
}
