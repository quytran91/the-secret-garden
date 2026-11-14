import { useRef, useState } from 'react'
import { useGarden } from '../store/garden'
import { useBlobUrl, useInView } from '../hooks'
import { REASON_TEXT } from '../lib/importer'
import type { ImageMeta } from '../lib/types'
import type { ConfirmRequest } from './Confirm'
import { IconHeart, IconPen, IconPlus, IconTrash } from './Icons'
import { Sheet } from './Sheet'

interface Props {
  open: boolean
  onClose: () => void
  onPick: () => void
  onOpenViewer: (id: string) => void
  confirm: (r: ConfirmRequest) => void
}

export function Collection({ open, onClose, onPick, onOpenViewer, confirm }: Props) {
  const g = useGarden()
  const [filter, setFilter] = useState<'all' | 'fav'>('all')
  const list = (filter === 'fav' ? g.images.filter((i) => i.favorite) : g.images).slice().reverse()
  const favCount = g.images.filter((i) => i.favorite).length

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Bộ sưu tập"
      subtitle={g.images.length ? `${g.images.length} ảnh thông điệp` : 'Chưa có ảnh nào'}
    >
      <div className="import-zone">
        <button className="btn btn-primary btn-sm" onClick={onPick} disabled={g.importJob?.running}>
          <IconPlus size={18} />
          <span>Thêm ảnh</span>
        </button>
        <p className="muted small">
          Chọn nhiều ảnh cùng lúc — JPEG, PNG hoặc WebP.
          <span className="desktop-only"> Bạn cũng có thể kéo thả ảnh vào cửa sổ này.</span>
        </p>
        <p className="privacy-note small">
          Ảnh chỉ được lưu trong trình duyệt trên thiết bị này, không tải lên máy chủ nào và không tự đồng bộ sang
          thiết bị khác. Nếu xoá dữ liệu trình duyệt, ảnh sẽ mất — hãy giữ bản gốc ở nơi khác.
        </p>
      </div>

      <ImportProgress />

      {g.images.length > 0 && (
        <div className="segmented" role="tablist" aria-label="Lọc ảnh">
          <button role="tab" aria-selected={filter === 'all'} onClick={() => setFilter('all')}>
            Tất cả
          </button>
          <button role="tab" aria-selected={filter === 'fav'} onClick={() => setFilter('fav')}>
            Yêu thích {favCount ? `· ${favCount}` : ''}
          </button>
        </div>
      )}

      {list.length === 0 && g.images.length > 0 && (
        <p className="muted center pad-y">Bạn chưa đánh dấu ảnh nào là yêu thích.</p>
      )}

      <ul className="grid" aria-label="Danh sách ảnh">
        {list.map((m) => (
          <Tile
            key={m.id}
            meta={m}
            onOpen={() => onOpenViewer(m.id)}
            onDelete={() =>
              confirm({
                title: 'Xoá ảnh này?',
                body: `“${m.name}” sẽ bị xoá khỏi thiết bị này cùng lịch sử đón nhận của nó. Không thể hoàn tác.`,
                confirmLabel: 'Xoá ảnh',
                onConfirm: () => g.remove(m.id),
              })
            }
          />
        ))}
      </ul>
    </Sheet>
  )
}

function Tile({ meta, onOpen, onDelete }: { meta: ImageMeta; onOpen: () => void; onDelete: () => void }) {
  const g = useGarden()
  const ref = useRef<HTMLLIElement>(null)
  const visible = useInView(ref)
  const { url, error } = useBlobUrl(meta.id, 'thumb', visible)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(meta.name)

  const save = async () => {
    setEditing(false)
    if (name.trim() && name.trim() !== meta.name) await g.rename(meta.id, name)
    else setName(meta.name)
  }

  return (
    <li className="tile" ref={ref}>
      <button className="tile-img" onClick={onOpen} aria-label={`Xem ảnh ${meta.name}`}>
        {url ? <img src={url} alt="" loading="lazy" decoding="async" /> : <span className={error ? 'tile-err' : 'tile-ph'} />}
      </button>
      <div className="tile-meta">
        {editing ? (
          <input
            className="tile-input"
            value={name}
            autoFocus
            maxLength={120}
            aria-label="Tên ảnh"
            onChange={(e) => setName(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') {
                e.stopPropagation()
                setName(meta.name)
                setEditing(false)
              }
            }}
          />
        ) : (
          <span className="tile-name" title={meta.name}>
            {meta.name}
          </span>
        )}
        <div className="tile-actions">
          <button
            className={`icon-btn sm ${meta.favorite ? 'is-active' : ''}`}
            aria-pressed={meta.favorite}
            aria-label={meta.favorite ? `Bỏ yêu thích ${meta.name}` : `Yêu thích ${meta.name}`}
            onClick={() => g.toggleFavorite(meta.id)}
          >
            <IconHeart size={17} filled={meta.favorite} />
          </button>
          <button className="icon-btn sm" aria-label={`Đổi tên ${meta.name}`} onClick={() => setEditing(true)}>
            <IconPen size={17} />
          </button>
          <button className="icon-btn sm" aria-label={`Xoá ${meta.name}`} onClick={onDelete}>
            <IconTrash size={17} />
          </button>
        </div>
      </div>
    </li>
  )
}

function ImportProgress() {
  const { importJob: job, dismissImport } = useGarden()
  if (!job) return null
  const pct = job.total ? Math.round((job.done / job.total) * 100) : 0
  const dup = job.failures.filter((f) => f.reason === 'duplicate').length
  const errs = job.failures.filter((f) => f.reason !== 'duplicate')
  return (
    <section className="import-progress" aria-live="polite">
      <div className="ip-row">
        <strong>{job.running ? `Đang nhập ${job.done}/${job.total} ảnh…` : 'Đã nhập xong'}</strong>
        {!job.running && (
          <button className="link-btn" onClick={dismissImport}>
            Ẩn
          </button>
        )}
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Tiến trình nhập ảnh"
      >
        <span style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      <p className="small muted">
        {job.added} ảnh nhập thành công
        {dup > 0 && ` · ${dup} ảnh trùng đã bỏ qua`}
        {errs.length > 0 && ` · ${errs.length} ảnh lỗi`}
      </p>
      {errs.length > 0 && (
        <ul className="ip-errors">
          {errs.map((f, i) => (
            <li key={i}>
              <span className="ip-file">{f.name}</span>
              <span>{REASON_TEXT[f.reason]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
