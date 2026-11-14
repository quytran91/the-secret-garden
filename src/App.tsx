import { useEffect, useRef, useState } from 'react'
import { GardenProvider, useGarden } from './store/garden'
import { useReducedMotion } from './hooks'
import { Home } from './components/Home'
import { Collection } from './components/Collection'
import { History } from './components/History'
import { SettingsSheet } from './components/SettingsSheet'
import { Viewer } from './components/Viewer'
import { Confirm, type ConfirmRequest } from './components/Confirm'
import { Sigil } from './components/Icons'

type Panel = 'collection' | 'history' | 'settings' | null

export default function App() {
  return (
    <GardenProvider>
      <Shell />
    </GardenProvider>
  )
}

function Shell() {
  const g = useGarden()
  const reduced = useReducedMotion(g.settings.motion)
  const [panel, setPanel] = useState<Panel>(null)
  const [viewerId, setViewerId] = useState<string | null>(null)
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduced)
  }, [reduced])

  // Đóng viewer nếu ảnh bị xoá
  useEffect(() => {
    if (viewerId && !g.imageById.has(viewerId)) setViewerId(null)
  }, [viewerId, g.imageById])

  const startImport = (files: File[]) => {
    if (!files.length) return
    setPanel('collection')
    void g.importFiles(files)
  }

  // Kéo thả ảnh trên desktop
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth++
      setDragging(true)
    }
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      startImport(Array.from(e.dataTransfer?.files ?? []))
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.importFiles])

  // Phải gọi trực tiếp trong sự kiện chạm để iOS cho mở trình chọn ảnh
  const pickFiles = () => fileInput.current?.click()

  const nav: [Exclude<Panel, null>, string][] = [
    ['collection', 'Bộ sưu tập'],
    ['history', 'Đã đón nhận'],
    ['settings', 'Cài đặt'],
  ]

  return (
    <div className="app">
      <div className="ambient" aria-hidden="true">
        <span className="glow glow-emerald" />
        <span className="glow glow-gold" />
        <Dust />
      </div>

      <header className="top">
        <h1 className="wordmark">
          <Sigil size={15} />
          <span>The Secret Garden</span>
        </h1>
        <p className="intro">Một khoảng lặng. Một điều biết ơn.</p>
      </header>

      <Home reduced={reduced} onAddImages={pickFiles} onOpenViewer={setViewerId} />

      <nav className="bottom-nav" aria-label="Điều hướng phụ">
        {nav.map(([key, label]) => (
          <button key={key} onClick={() => setPanel(key)} aria-haspopup="dialog">
            {label}
          </button>
        ))}
      </nav>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          startImport(files)
        }}
      />

      <Collection
        open={panel === 'collection'}
        onClose={() => setPanel(null)}
        onPick={pickFiles}
        onOpenViewer={setViewerId}
        confirm={setConfirmReq}
      />
      <History open={panel === 'history'} onClose={() => setPanel(null)} onOpenViewer={setViewerId} />
      <SettingsSheet open={panel === 'settings'} onClose={() => setPanel(null)} confirm={setConfirmReq} />

      {viewerId && <Viewer id={viewerId} onClose={() => setViewerId(null)} />}
      <Confirm req={confirmReq} onClose={() => setConfirmReq(null)} />

      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-inner">
            <span className="title-serif">Thả ảnh vào khu vườn</span>
            <span className="small muted">JPEG, PNG hoặc WebP</span>
          </div>
        </div>
      )}

      <div className="toasts" role="status" aria-live="polite">
        {g.toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  )
}

const DUST = Array.from({ length: 16 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  top: (i * 53 + 7) % 100,
  size: 1 + ((i * 7) % 3) * 0.6,
  dur: 18 + ((i * 13) % 14),
  delay: -((i * 5.3) % 20),
}))

function Dust() {
  return (
    <>
      {DUST.map((d, i) => (
        <span
          key={i}
          className="dust"
          style={{
            left: `${d.left}%`,
            top: `${d.top}%`,
            width: d.size,
            height: d.size,
            animationDuration: `${d.dur}s`,
            animationDelay: `${d.delay}s`,
          }}
        />
      ))}
    </>
  )
}
