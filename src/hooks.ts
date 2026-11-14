import { useEffect, useState, type RefObject } from 'react'
import { getDB, getOriginal, getThumb } from './lib/db'
import type { MotionPref } from './lib/types'

/** Object URL cho thumbnail / ảnh gốc; tự revoke khi id đổi hoặc unmount. */
export function useBlobUrl(id: string | null, kind: 'thumb' | 'original', enabled = true) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    if (!id || !enabled) return
    let alive = true
    let made: string | null = null
    setError(false)
    ;(async () => {
      const db = await getDB()
      const blob = kind === 'thumb' ? await getThumb(db, id) : await getOriginal(db, id)
      if (!alive) return
      if (!blob) {
        setError(true)
        return
      }
      made = URL.createObjectURL(blob)
      setUrl(made)
    })().catch(() => alive && setError(true))
    return () => {
      alive = false
      if (made) URL.revokeObjectURL(made)
      setUrl(null)
    }
  }, [id, kind, enabled])
  return { url, error }
}

export function useSystemReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

export function useReducedMotion(pref: MotionPref) {
  const sys = useSystemReducedMotion()
  return pref === 'reduce' || (pref === 'system' && sys)
}

export function useInView(ref: RefObject<Element | null>, rootMargin = '200px') {
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true)
          io.disconnect()
        }
      },
      { rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, rootMargin, seen])
  return seen
}
