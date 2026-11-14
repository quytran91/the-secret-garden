import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as store from '../lib/db'
import { prepareFile, type FailReason } from '../lib/importer'
import type { BagState, CurrentDraw, ImageMeta, Settings } from '../lib/types'
import { DEFAULT_SETTINGS } from '../lib/types'
import { levelFor } from '../lib/level'

export interface ImportJob {
  running: boolean
  total: number
  done: number
  added: number
  failures: { name: string; reason: FailReason }[]
}

export interface Toast {
  id: number
  text: string
  tone: 'info' | 'error' | 'level'
}

interface GardenState {
  status: 'loading' | 'ready' | 'error'
  images: ImageMeta[]
  bag: BagState | null
  settings: Settings
  current: CurrentDraw | null
  received: number
}

interface GardenApi extends GardenState {
  imageById: Map<string, ImageMeta>
  importJob: ImportJob | null
  toasts: Toast[]
  historyVersion: number
  importFiles: (files: File[]) => Promise<void>
  dismissImport: () => void
  rename: (id: string, name: string) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  clearAll: () => Promise<void>
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  commitDraw: () => Promise<store.DrawCommit>
  markRevealed: (drawId: string) => Promise<void>
  rollback: (drawId: string) => Promise<void>
  newRound: () => Promise<void>
  toast: (text: string, tone?: Toast['tone']) => void
}

const Ctx = createContext<GardenApi | null>(null)

export function useGarden() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useGarden ngoài GardenProvider')
  return v
}

export function GardenProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GardenState>({
    status: 'loading',
    images: [],
    bag: null,
    settings: DEFAULT_SETTINGS,
    current: null,
    received: 0,
  })
  const [importJob, setImportJob] = useState<ImportJob | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [historyVersion, setHistoryVersion] = useState(0)
  const dbRef = useRef<store.GardenDB | null>(null)
  const importing = useRef(false)
  const queue = useRef<File[]>([])

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-2), { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3200)
  }, [])

  const db = useCallback(async () => {
    if (!dbRef.current) dbRef.current = await store.getDB()
    return dbRef.current
  }, [])

  const reload = useCallback(async () => {
    const snap = await store.loadSnapshot(await db())
    setState({ status: 'ready', ...snap })
  }, [db])

  useEffect(() => {
    reload().catch((err) => {
      console.error(err)
      setState((s) => ({ ...s, status: 'error' }))
    })
  }, [reload])

  const importFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return
      if (importing.current) {
        // Đang nhập dở: xếp hàng, không bỏ ảnh nào
        queue.current.push(...files)
        setImportJob((j) => (j ? { ...j, total: j.total + files.length } : j))
        return
      }
      importing.current = true
      files = [...files]
      const d = await db()
      const job: ImportJob = { running: true, total: files.length, done: 0, added: 0, failures: [] }
      setImportJob({ ...job })
      let quotaHit = false
      let seq = (await store.loadSnapshot(d)).images.length
      for (let k = 0; k < files.length || queue.current.length; k++) {
        if (k >= files.length) {
          files.push(...queue.current.splice(0))
          job.total = files.length
        }
        const file = files[k]
        if (quotaHit) {
          job.failures.push({ name: file.name, reason: 'quota' })
        } else {
          try {
            const prepared = await prepareFile(
              file,
              async (h) => !!(await store.findByHash(d, h)),
              `Thông điệp ${seq + 1}`,
            )
            if (!prepared.ok) {
              job.failures.push({ name: file.name, reason: prepared.reason })
            } else {
              const r = await store.addImage(d, prepared.meta, prepared.original, prepared.thumb)
              if (r.status === 'duplicate') job.failures.push({ name: file.name, reason: 'duplicate' })
              else {
                job.added++
                seq++
                setState((s) => ({ ...s, images: [...s.images, r.meta] }))
              }
            }
          } catch (err) {
            if (err instanceof store.QuotaError || store.isQuotaError(err)) {
              quotaHit = true
              job.failures.push({ name: file.name, reason: 'quota' })
            } else {
              console.error(err)
              job.failures.push({ name: file.name, reason: 'unknown' })
            }
          }
        }
        job.done++
        setImportJob({ ...job, failures: [...job.failures] })
      }
      job.running = false
      setImportJob({ ...job, failures: [...job.failures] })
      importing.current = false
      await reload()
      if (job.added > 0) {
        // Xin trình duyệt giữ dữ liệu lâu dài (không bắt buộc)
        navigator.storage?.persist?.().catch(() => undefined)
      }
    },
    [db, reload, toast],
  )

  const api = useMemo<GardenApi>(() => {
    const imageById = new Map(state.images.map((i) => [i.id, i]))
    return {
      ...state,
      imageById,
      importJob,
      toasts,
      historyVersion,
      importFiles,
      toast,
      dismissImport: () => setImportJob((j) => (j?.running ? j : null)),
      async rename(id, name) {
        const clean = name.trim().slice(0, 120)
        if (!clean) return
        const next = await store.updateMeta(await db(), id, { name: clean })
        if (next) setState((s) => ({ ...s, images: s.images.map((i) => (i.id === id ? next : i)) }))
      },
      async toggleFavorite(id) {
        const cur = imageById.get(id)
        if (!cur) return
        const next = await store.updateMeta(await db(), id, { favorite: !cur.favorite })
        if (next) setState((s) => ({ ...s, images: s.images.map((i) => (i.id === id ? next : i)) }))
      },
      async remove(id) {
        const bag = await store.deleteImage(await db(), id)
        setState((s) => ({
          ...s,
          bag,
          images: s.images.filter((i) => i.id !== id),
          current: s.current?.imageId === id ? null : s.current,
        }))
        setHistoryVersion((v) => v + 1)
      },
      async clearAll() {
        await store.clearAll(await db())
        await reload()
        setHistoryVersion((v) => v + 1)
      },
      async updateSettings(patch) {
        const settings = { ...state.settings, ...patch }
        setState((s) => ({ ...s, settings }))
        await store.saveSettings(await db(), settings)
      },
      async commitDraw() {
        const r = await store.commitDraw(await db(), state.settings.mode)
        if (r.status === 'ok') setState((s) => ({ ...s, bag: r.bag, current: r.current }))
        else if (r.status === 'roundComplete') setState((s) => ({ ...s, bag: r.bag }))
        setHistoryVersion((v) => v + 1)
        return r
      },
      async markRevealed(drawId) {
        const before = levelFor(state.received).level
        const received = await store.markRevealed(await db(), drawId)
        setState((s) => ({
          ...s,
          received,
          current: s.current?.drawId === drawId ? { ...s.current, revealed: true } : s.current,
        }))
        const after = levelFor(received)
        if (after.level > before) toast(`Lên cấp LV.${after.level} · ${after.title}!`, 'level')
      },
      async rollback(drawId) {
        const bag = await store.rollbackDraw(await db(), drawId)
        setState((s) => ({ ...s, bag: bag ?? s.bag, current: s.current?.drawId === drawId ? null : s.current }))
        setHistoryVersion((v) => v + 1)
      },
      async newRound() {
        const bag = await store.newRound(await db())
        setState((s) => ({ ...s, bag }))
      },
    }
  }, [state, importJob, toasts, historyVersion, importFiles, toast, db, reload])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

/** Truy cập DB trực tiếp cho các hook đọc blob */
export const gardenDB = () => store.getDB()
