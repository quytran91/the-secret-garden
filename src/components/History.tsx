import { useEffect, useRef, useState } from 'react'
import { useGarden } from '../store/garden'
import { getDB, listHistory } from '../lib/db'
import { useBlobUrl, useInView } from '../hooks'
import type { HistoryEntry } from '../lib/types'
import { Sheet } from './Sheet'

const dayKey = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayLabel(t: number) {
  const now = new Date()
  const today = dayKey(now.getTime())
  const y = new Date(now)
  y.setDate(now.getDate() - 1)
  const k = dayKey(t)
  if (k === today) return 'Hôm nay'
  if (k === dayKey(y.getTime())) return 'Hôm qua'
  return new Date(t).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })
}

const timeOf = (t: number) => new Date(t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

export function History({ open, onClose, onOpenViewer }: { open: boolean; onClose: () => void; onOpenViewer: (id: string) => void }) {
  const g = useGarden()
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    getDB()
      .then(listHistory)
      .then((h) => alive && setEntries(h))
      .catch(() => alive && setEntries([]))
    return () => {
      alive = false
    }
  }, [open, g.historyVersion])

  // Chỉ hiện lượt đã xem xong (lượt đang chạy hiệu ứng chưa tính)
  const visible = (entries ?? []).filter(
    (e) => g.imageById.has(e.imageId) && !(g.current?.drawId === e.id && !g.current.revealed),
  )
  const groups: { label: string; items: HistoryEntry[] }[] = []
  for (const e of visible) {
    const label = dayLabel(e.at)
    const last = groups[groups.length - 1]
    if (last?.label === label) last.items.push(e)
    else groups.push({ label, items: [e] })
  }

  return (
    <Sheet open={open} onClose={onClose} title="Đã đón nhận" subtitle={visible.length ? `${visible.length} lần đón nhận` : undefined}>
      {entries === null ? (
        <p className="muted center pad-y">Đang mở lại những trang nhật ký…</p>
      ) : groups.length === 0 ? (
        <div className="center pad-y">
          <p className="title-serif soft-title">Chưa có thông điệp nào được đón nhận.</p>
          <p className="muted small">Mỗi lần bạn mở một món quà, nó sẽ được ghi lại ở đây theo từng ngày.</p>
        </div>
      ) : (
        groups.map((grp) => (
          <section key={grp.label} className="hist-day">
            <h3 className="eyebrow">{grp.label}</h3>
            <ul>
              {grp.items.map((e) => (
                <HistRow key={e.id} entry={e} name={g.imageById.get(e.imageId)?.name ?? ''} onOpen={() => onOpenViewer(e.imageId)} />
              ))}
            </ul>
          </section>
        ))
      )}
    </Sheet>
  )
}

function HistRow({ entry, name, onOpen }: { entry: HistoryEntry; name: string; onOpen: () => void }) {
  const ref = useRef<HTMLLIElement>(null)
  const seen = useInView(ref)
  const { url } = useBlobUrl(entry.imageId, 'thumb', seen)
  return (
    <li ref={ref}>
      <button className="hist-row" onClick={onOpen} aria-label={`Xem lại ${name}, lúc ${timeOf(entry.at)}`}>
        <span className="hist-thumb">{url && <img src={url} alt="" />}</span>
        <span className="hist-text">
          <span className="hist-name">{name}</span>
          <span className="muted small">{timeOf(entry.at)}</span>
        </span>
      </button>
    </li>
  )
}
