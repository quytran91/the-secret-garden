import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useGarden } from '../store/garden'
import { chime, haptic, unlockAudio } from '../lib/feedback'
import { loadOriginal, thumbMosaic, type LoadedOriginal } from '../lib/media'
import { paintMosaic, sizeCanvas, type Mosaicable } from '../lib/pixel'
import { shuffle } from '../lib/bag'
import {
  anim,
  buildStrip,
  paintIdle,
  REVEAL_STEP_MS,
  REVEAL_STEPS,
  spin,
  wait,
} from './animate'
import { EmptyCard } from './EmptyCard'
import { IconExpand, IconHeart } from './Icons'

type Phase = 'idle' | 'drawing' | 'revealed'

interface Props {
  reduced: boolean
  onAddImages: () => void
  onOpenViewer: (id: string) => void
}

const SPIN_MS = 1900
const STRIP_TARGET = 11
const STRIP_COUNT = 14

export function Home({ reduced, onAddImages, onOpenViewer }: Props) {
  const g = useGarden()
  const [phase, setPhase] = useState<Phase>('idle')
  const [resultId, setResultId] = useState<string | null>(null)
  const [waiting, setWaiting] = useState(false)

  const heroRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const backRefs = [useRef<HTMLCanvasElement>(null), useRef<HTMLCanvasElement>(null)]
  const backWrapRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLButtonElement>(null)

  const busy = useRef(false)
  const alive = useRef(true)
  const original = useRef<LoadedOriginal | null>(null)
  const restored = useRef(false)
  const idleIds = useRef<string[]>([])
  const heroMosaic = useRef<Mosaicable | null>(null)

  const { images, bag, settings, current, status } = g
  const count = images.length
  const roundComplete = settings.mode === 'bag' && count > 0 && !!bag && bag.remaining.length === 0
  const resultMeta = resultId ? g.imageById.get(resultId) : undefined

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      if (original.current) URL.revokeObjectURL(original.current.url)
      original.current = null
    }
  }, [])

  const setOriginal = (o: LoadedOriginal | null) => {
    const prev = original.current
    original.current = o
    if (prev && prev.url !== o?.url) URL.revokeObjectURL(prev.url)
  }

  /* ---------- Trạng thái chờ: card mosaic + 2 card phía sau ---------- */
  const paintIdleScene = useCallback(async () => {
    const hero = canvasRef.current
    if (!hero || images.length === 0) return
    const ids = images.map((i) => i.id)
    if (!idleIds.current.length || idleIds.current.some((id) => !g.imageById.has(id))) {
      idleIds.current = shuffle(ids).slice(0, 3)
    }
    const [a, b, c] = idleIds.current
    try {
      const ma = await thumbMosaic(a)
      if (!alive.current || busy.current) return
      heroMosaic.current = ma
      sizeCanvas(hero)
      paintIdle(hero, ma)
      const back = [b ?? a, c ?? b ?? a]
      for (let i = 0; i < 2; i++) {
        const cv = backRefs[i].current
        if (!cv) continue
        const m = await thumbMosaic(back[i])
        if (!alive.current || busy.current) return
        sizeCanvas(cv)
        paintMosaic(cv, m, { cols: 8, dim: 0.62 })
      }
    } catch {
      /* ảnh vừa bị xoá — lần render sau sẽ chọn lại */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, g.imageById])

  useLayoutEffect(() => {
    if (phase === 'idle' && !roundComplete && status === 'ready') void paintIdleScene()
  }, [phase, roundComplete, status, paintIdleScene])

  // Vẽ lại khi đổi kích thước (xoay máy, đổi cửa sổ)
  useEffect(() => {
    const hero = heroRef.current
    if (!hero || typeof ResizeObserver === 'undefined') return
    let raf = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (busy.current) return
        const cv = canvasRef.current
        if (!cv) return
        sizeCanvas(cv)
        if (phase === 'revealed' && original.current) paintMosaic(cv, original.current.mosaic, { cols: 0, dim: 0 })
        else if (heroMosaic.current) paintIdle(cv, heroMosaic.current)
        for (const r of backRefs) if (r.current) sizeCanvas(r.current)
        if (phase === 'idle') void paintIdleScene()
      })
    })
    ro.observe(hero)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paintIdleScene])

  // Ảnh đang hiển thị bị xoá → quay về trạng thái chờ
  useEffect(() => {
    if (phase === 'revealed' && resultId && !g.imageById.has(resultId)) {
      setResultId(null)
      setOriginal(null)
      resetHero()
      setPhase('idle')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.imageById, phase, resultId])

  function resetHero() {
    const img = imgRef.current
    const glow = glowRef.current
    const hero = heroRef.current
    if (img) {
      img.style.opacity = '0'
      img.removeAttribute('src')
    }
    if (glow) glow.style.opacity = '0'
    if (hero) {
      hero.style.transform = ''
      hero.style.visibility = ''
    }
    if (backWrapRef.current) backWrapRef.current.style.opacity = ''
  }

  const finishReveal = useCallback(
    (drawId: string, imageId: string) => {
      setResultId(imageId)
      setPhase('revealed')
      setWaiting(false)
      busy.current = false
      void g.markRevealed(drawId)
      if (settings.sound) chime()
      if (settings.haptics) haptic([8, 40, 14])
    },
    [g, settings.sound, settings.haptics],
  )

  /* ---------- Khôi phục lượt bốc chưa xem xong sau khi reload ---------- */
  useEffect(() => {
    if (restored.current || status !== 'ready') return
    restored.current = true
    if (!current || current.revealed) return
    let cancelled = false
    busy.current = true
    setPhase('drawing')
    ;(async () => {
      try {
        const o = await loadOriginal(current.imageId)
        if (cancelled) return URL.revokeObjectURL(o.url)
        setOriginal(o)
        await showClear(o, 520)
        finishReveal(current.drawId, current.imageId)
      } catch (err) {
        if (cancelled) return
        console.error('restore', err)
        await g.rollback(current.drawId)
        g.toast('Không mở được ảnh của lượt trước. Bạn có thể đón nhận lại.', 'error')
        busy.current = false
        resetHero()
        setPhase('idle')
      }
    })()
    return () => {
      // Bị huỷ (unmount / StrictMode mount lại) → cho phép lần chạy sau khôi phục lại
      cancelled = true
      restored.current = false
      busy.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, current])

  /** Hiện ảnh rõ: fade ảnh, viền sáng champagne */
  async function showClear(o: LoadedOriginal, ms: number) {
    const img = imgRef.current!
    const cv = canvasRef.current!
    const glow = glowRef.current!
    const hero = heroRef.current!
    img.src = o.url
    img.alt = g.imageById.get(o.id)?.name ?? 'Thông điệp'
    try {
      await img.decode()
    } catch {
      /* đã decode trước đó */
    }
    hero.style.visibility = ''
    await Promise.all([
      anim(img, [{ opacity: 0 }, { opacity: 1 }], ms, 'ease-out'),
      anim(glow, [{ opacity: 0 }, { opacity: 1 }], ms + 200, "ease-out"),
      reduced ? Promise.resolve() : anim(hero, [{ transform: hero.style.transform || 'scale(1)' }, { transform: 'scale(1)' }], ms + 260),
    ])
    sizeCanvas(cv)
    paintMosaic(cv, o.mosaic, { cols: 0, dim: 0 })
  }

  /* ---------- Bốc ---------- */
  const draw = useCallback(async () => {
    if (busy.current || status !== 'ready') return
    busy.current = true
    if (settings.sound) unlockAudio()
    if (settings.haptics) haptic(6)

    let r
    try {
      r = await g.commitDraw()
    } catch (err) {
      console.error(err)
      g.toast('Không đọc được bộ nhớ. Hãy thử tải lại trang.', 'error')
      busy.current = false
      return
    }
    if (r.status !== 'ok') {
      if (r.status === 'roundComplete') {
        // Hết vòng: rời ảnh đang mở, hiện lời chúc + "Bắt đầu vòng mới"
        resetHero()
        setResultId(null)
        setOriginal(null)
        setPhase('idle')
      }
      busy.current = false
      return
    }
    const { drawId, imageId } = r.current
    const prevResult = phase === 'revealed' ? original.current : null
    setPhase('drawing')
    const origP = loadOriginal(imageId)
    origP.catch(() => undefined)

    const hero = heroRef.current!
    const cv = canvasRef.current!
    const img = imgRef.current!
    const glow = glowRef.current!
    const strip = stripRef.current!
    const isAlive = () => alive.current

    try {
      // 1) Ảnh đang mở (nếu có) được che lại thành mosaic trước khi lướt
      if (prevResult) {
        sizeCanvas(cv)
        paintIdle(cv, prevResult.mosaic)
        await Promise.all([
          anim(img, [{ opacity: 1 }, { opacity: 0 }], reduced ? 180 : 320, 'ease-in'),
          anim(glow, [{ opacity: 1 }, { opacity: 0 }], 260, 'ease-in'),
        ])
        img.removeAttribute('src')
      }

      if (reduced) {
        // Giảm chuyển động: không có vòng lướt, chỉ chuyển cảnh ngắn
        setWaiting(true)
        const o = await origP
        if (!isAlive()) return
        setOriginal(o)
        await showClear(o, 420)
        finishReveal(drawId, imageId)
        return
      }

      // 2) Dựng dải card: card đầu trùng card đang hiển thị, card trúng ở vị trí STRIP_TARGET
      const startMosaic = prevResult?.mosaic ?? heroMosaic.current
      const ids = images.map((i) => i.id)
      const decoyIds = shuffle(ids.length > 1 ? ids.filter((id) => id !== imageId) : ids)
      const pickDecoy = (i: number) => decoyIds[i % decoyIds.length]
      const plan: (string | null)[] = []
      for (let i = 0; i < STRIP_COUNT; i++) {
        plan.push(i === 0 ? null : i === STRIP_TARGET ? imageId : pickDecoy(i))
      }
      const unique = [...new Set(plan.filter((x): x is string => !!x))]
      const mosaics = new Map<string, Mosaicable>()
      await Promise.all(
        unique.map(async (id) => {
          try {
            mosaics.set(id, await thumbMosaic(id))
          } catch {
            /* bỏ qua card lỗi, vẫn còn ảnh khác */
          }
        }),
      )
      if (!isAlive()) return
      const w = hero.offsetWidth
      const h = hero.offsetHeight
      const step = w + Math.max(16, w * 0.07)
      const cards = buildStrip(strip, STRIP_COUNT, w, h)
      cards.forEach((c, i) => {
        const id = plan[i]
        const m = id ? mosaics.get(id) : startMosaic
        const fallback = mosaics.get(imageId) ?? startMosaic
        const use = m ?? fallback
        if (use) paintIdle(c.canvas, use)
      })
      strip.style.visibility = 'visible'
      hero.style.visibility = 'hidden'
      void anim(backWrapRef.current!, [{ opacity: 1 }, { opacity: 0 }], 360, 'ease-out')

      // 3) Lướt nhanh rồi chậm dần, dừng chính xác ở card trúng
      await spin(cards, STRIP_TARGET, step, SPIN_MS, isAlive)
      if (!isAlive()) return

      // 4) Card trúng tiến nhẹ ra phía trước, các card khác lùi đi
      const win = cards[STRIP_TARGET].el
      win.classList.add('is-winner')
      await Promise.all([
        anim(win, [{ transform: 'translate3d(0,0,0) scale(1)' }, { transform: 'translate3d(0,0,0) scale(1.045)' }], 340),
        ...cards
          .filter((_, i) => i !== STRIP_TARGET)
          .map((c) => anim(c.el, [{ opacity: c.el.style.opacity || '1' }, { opacity: 0 }], 300, 'ease-out')),
      ])

      // 5) Chờ ảnh gốc đã preload (thường đã xong từ lâu)
      setWaiting(true)
      const o = await origP
      if (!isAlive()) {
        URL.revokeObjectURL(o.url)
        return
      }
      setOriginal(o)
      setWaiting(false)

      // 6) Pixel nhỏ dần: 12 → 24 → 48 → 96 ô
      hero.style.transform = 'scale(1.045)'
      sizeCanvas(cv)
      paintMosaic(cv, o.mosaic, REVEAL_STEPS[0])
      hero.style.visibility = ''
      strip.style.visibility = 'hidden'
      strip.replaceChildren()
      for (let i = 1; i < REVEAL_STEPS.length; i++) {
        await wait(REVEAL_STEP_MS)
        if (!isAlive()) return
        paintMosaic(cv, o.mosaic, REVEAL_STEPS[i])
      }
      await wait(REVEAL_STEP_MS * 0.8)

      // 7) Ảnh rõ + viền sáng champagne
      await showClear(o, 520)
      finishReveal(drawId, imageId)
    } catch (err) {
      console.error(err)
      strip.style.visibility = 'hidden'
      strip.replaceChildren()
      await g.rollback(drawId)
      g.toast('Không mở được ảnh này. Lượt bốc đã được hoàn lại, bạn có thể thử lại.', 'error')
      setOriginal(null)
      resetHero()
      setWaiting(false)
      setResultId(null)
      busy.current = false
      setPhase('idle')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g, images, phase, reduced, settings, status, finishReveal])

  // Sau khi lượt bốc xong, đưa focus về nút chính cho người dùng bàn phím
  useEffect(() => {
    if (phase === 'revealed') ctaRef.current?.focus({ preventScroll: true })
  }, [phase])

  const onNewRound = async () => {
    await g.newRound()
    idleIds.current = []
    resetHero()
    setResultId(null)
    setOriginal(null)
    setPhase('idle')
  }

  const showComplete = roundComplete && phase === 'idle'

  const countLine = useMemo(() => {
    if (settings.mode === 'free') return `Ngẫu nhiên tự do · ${count} ảnh`
    if (!bag) return ''
    if (bag.remaining.length === 0) return `Bạn đã mở trọn vòng ${bag.round}`
    return `Còn ${bag.remaining.length} ảnh chưa mở trong vòng ${bag.round}`
  }, [settings.mode, bag, count])

  if (status === 'loading') {
    return (
      <main className="home" aria-busy="true">
        <div className="stage">
          <div className="hero-card is-loading" aria-label="Đang mở khu vườn" />
        </div>
      </main>
    )
  }

  if (status === 'error') {
    return (
      <main className="home">
        <div className="notice-block" role="alert">
          <h2 className="title-serif">Khu vườn chưa mở được</h2>
          <p>
            Trình duyệt đang chặn bộ nhớ cục bộ (IndexedDB) — thường do chế độ duyệt riêng tư. Hãy mở bằng cửa sổ
            thường rồi tải lại trang.
          </p>
        </div>
      </main>
    )
  }

  if (count === 0) {
    return (
      <main className="home">
        <div className="stage">
          <EmptyCard />
        </div>
        <div className="controls">
          <h2 className="title-serif empty-title">Những món quà của bạn bắt đầu từ đây</h2>
          <p className="muted small center">Nạp những ảnh thông điệp của riêng bạn — lời biết ơn, gia đình, kỷ niệm, mong ước.</p>
          <button className="btn btn-primary" onClick={onAddImages}>
            Thêm ảnh của bạn
          </button>
        </div>
      </main>
    )
  }

  const revealed = phase === 'revealed' && !!resultMeta
  return (
    <main className={`home phase-${phase}`}>
      <p className={`stage-caption ${revealed ? 'is-on' : ''}`} aria-live="polite">
        {revealed ? 'Thông điệp dành cho bạn' : phase === 'drawing' ? (waiting ? 'Đang mở món quà…' : ' ') : ' '}
      </p>
      <div className="stage">
        <div className="back-stack" ref={backWrapRef} aria-hidden="true" hidden={showComplete}>
          <div className="back-card back-1">
            <canvas ref={backRefs[0]} />
          </div>
          <div className="back-card back-2">
            <canvas ref={backRefs[1]} />
          </div>
        </div>
        <div className="strip" ref={stripRef} aria-hidden="true" />
        {showComplete ? (
          <div className="hero-card complete-card">
            <div className="complete-inner">
              <span className="eyebrow">Trọn một vòng</span>
              <h2 className="title-serif">Bạn đã đón nhận tất cả những món quà của vòng này.</h2>
              <p className="muted">Cảm ơn bạn đã dành thời gian cho những điều quý giá.</p>
            </div>
          </div>
        ) : (
          <div
            className={`hero-card ${revealed ? 'is-revealed' : ''}`}
            ref={heroRef}
            role={revealed ? 'button' : undefined}
            tabIndex={revealed ? 0 : -1}
            aria-label={revealed ? `Xem lớn: ${resultMeta?.name}` : 'Món quà đang được che kín'}
            onClick={() => revealed && resultId && onOpenViewer(resultId)}
            onKeyDown={(e) => {
              if (revealed && resultId && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                onOpenViewer(resultId)
              }
            }}
          >
            <canvas ref={canvasRef} className="hero-canvas" aria-hidden="true" />
            <img ref={imgRef} className="hero-img" alt="" draggable={false} />
            <div ref={glowRef} className="hero-glow" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="controls">
        {revealed ? (
          <>
            <p className="breath">Dành một nhịp thở để cảm nhận điều này.</p>
            <div className="result-actions">
              <button
                className={`btn btn-ghost btn-icon-text ${resultMeta?.favorite ? 'is-active' : ''}`}
                aria-pressed={!!resultMeta?.favorite}
                onClick={() => resultId && g.toggleFavorite(resultId)}
              >
                <IconHeart size={18} filled={!!resultMeta?.favorite} />
                <span>Yêu thích</span>
              </button>
              <button className="btn btn-ghost btn-icon-text" onClick={() => resultId && onOpenViewer(resultId)}>
                <IconExpand size={18} />
                <span>Xem toàn ảnh</span>
              </button>
            </div>
            <button ref={ctaRef} className="btn btn-primary" onClick={draw}>
              Đón nhận thêm
            </button>
          </>
        ) : showComplete ? (
          <button ref={ctaRef} className="btn btn-primary" onClick={onNewRound}>
            Bắt đầu vòng mới
          </button>
        ) : (
          <button
            ref={ctaRef}
            className="btn btn-primary"
            onClick={draw}
            disabled={phase === 'drawing'}
            aria-busy={phase === 'drawing'}
          >
            {phase === 'drawing' ? 'Đang đón nhận…' : 'Đón nhận thông điệp'}
          </button>
        )}
        <p className="count-line">{countLine}</p>
      </div>
    </main>
  )
}
