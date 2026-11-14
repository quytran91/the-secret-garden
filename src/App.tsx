import { useEffect, useRef, useState } from 'react'
import { GardenProvider, useGarden } from './store/garden'
import { useReducedMotion } from './hooks'
import { Home } from './components/Home'
import { Collection } from './components/Collection'
import { History } from './components/History'
import { SettingsSheet } from './components/SettingsSheet'
import { Viewer } from './components/Viewer'
import { Confirm, type ConfirmRequest } from './components/Confirm'
import { IconMute, IconSound } from './components/Icons'
import { PixelCloud, PixelDiamond, PixelPalm } from './components/Pixel'
import { chime, unlockAudio } from './lib/feedback'

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

  const toggleSound = () => {
    const sound = !g.settings.sound
    if (sound) {
      unlockAudio()
      setTimeout(chime, 60)
    }
    void g.updateSettings({ sound })
  }

  return (
    <div className="app">
      <Scenery />

      <header className="top">
        <h1 className="brand">
          <PixelDiamond size={26} className="brand-gem" />
          <span className="brand-plate">The Secret Garden</span>
        </h1>
        <div className="top-actions">
          <button className="chip" onClick={() => setPanel('collection')} aria-haspopup="dialog">
            Bộ sưu tập
          </button>
          <button
            className={`chip chip-icon ${g.settings.sound ? 'is-on' : ''}`}
            onClick={toggleSound}
            aria-pressed={g.settings.sound}
            aria-label={g.settings.sound ? 'Tắt âm thanh' : 'Bật âm thanh'}
          >
            {g.settings.sound ? <IconSound size={20} /> : <IconMute size={20} />}
          </button>
        </div>
      </header>

      <Home reduced={reduced} onAddImages={pickFiles} onOpenViewer={setViewerId} />

      <nav className="bottom-nav" aria-label="Điều hướng phụ">
        <button className="link-chip" onClick={() => setPanel('history')} aria-haspopup="dialog">
          Đã đón nhận
        </button>
        <button className="link-chip" onClick={() => setPanel('settings')} aria-haspopup="dialog">
          Cài đặt
        </button>
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

/** Nền: trời xanh, tia sáng, mây pixel, biển, cát và cây dừa — chỉ CSS + SVG */
function Scenery() {
  return (
    <div className="scenery" aria-hidden="true">
      <div className="rays" />
      <PixelCloud className="cloud cloud-1" />
      <PixelCloud className="cloud cloud-2" />
      <PixelCloud className="cloud cloud-3" />
      <div className="sea" />
      <div className="sand" />
      <PixelPalm className="palm palm-l" />
      <PixelPalm className="palm palm-r" />
    </div>
  )
}
