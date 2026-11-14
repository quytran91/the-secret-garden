/** Âm thanh chime bằng Web Audio + haptic — cả hai đều là phần bổ sung, có thể vắng mặt. */

type AC = typeof AudioContext
let ctx: AudioContext | null = null

/** Chỉ gọi trong một tương tác của người dùng. */
export function unlockAudio() {
  try {
    if (!ctx) {
      const Ctor: AC | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext
      if (!Ctor) return
      ctx = new Ctor()
    }
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

/** Tiếng chuông rất nhẹ, kiểu chuông pha lê: vài partial sine, tắt dần. */
export function chime() {
  if (!ctx || ctx.state !== 'running') return
  const now = ctx.currentTime + 0.02
  const master = ctx.createGain()
  master.gain.value = 0.11
  master.connect(ctx.destination)
  const partials: [number, number, number][] = [
    [783.99, 1, 2.6],
    [1174.66, 0.55, 2.2],
    [1567.98, 0.32, 1.7],
    [2349.32, 0.12, 1.1],
  ]
  for (const [freq, amp, decay] of partials) {
    for (const detune of [-3, 3]) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = freq
      o.detune.value = detune
      g.gain.setValueAtTime(0.0001, now)
      g.gain.exponentialRampToValueAtTime(amp * 0.5, now + 0.025)
      g.gain.exponentialRampToValueAtTime(0.0001, now + decay)
      o.connect(g).connect(master)
      o.start(now)
      o.stop(now + decay + 0.05)
    }
  }
}

export function haptic(pattern: number | number[] = 12) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* không hỗ trợ — bỏ qua */
  }
}
