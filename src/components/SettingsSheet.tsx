import { useEffect, useState } from 'react'
import { useGarden } from '../store/garden'
import { unlockAudio, chime } from '../lib/feedback'
import type { DrawMode, MotionPref } from '../lib/types'
import type { ConfirmRequest } from './Confirm'
import { Sheet } from './Sheet'

function fmtBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

export function SettingsSheet({ open, onClose, confirm }: { open: boolean; onClose: () => void; confirm: (r: ConfirmRequest) => void }) {
  const g = useGarden()
  const s = g.settings
  const [est, setEst] = useState<{ usage: number; quota: number; persisted: boolean } | null>(null)

  useEffect(() => {
    if (!open || !navigator.storage?.estimate) return
    Promise.all([navigator.storage.estimate(), navigator.storage.persisted?.() ?? Promise.resolve(false)])
      .then(([e, p]) => setEst({ usage: e.usage ?? 0, quota: e.quota ?? 0, persisted: p }))
      .catch(() => setEst(null))
  }, [open, g.images.length])

  const imagesBytes = g.images.reduce((a, i) => a + i.size, 0)

  return (
    <Sheet open={open} onClose={onClose} title="Cài đặt" size="auto">
      <fieldset className="setting">
        <legend>Cách bốc</legend>
        <Radio<DrawMode>
          name="mode"
          value={s.mode}
          onChange={(mode) => g.updateSettings({ mode })}
          options={[
            ['bag', 'Không lặp cho đến khi xem hết', 'Mỗi ảnh xuất hiện đúng một lần trong mỗi vòng.'],
            ['free', 'Ngẫu nhiên tự do', 'Mỗi lượt chọn ngẫu nhiên từ toàn bộ ảnh, có thể lặp lại.'],
          ]}
        />
        {s.mode === 'bag' && g.bag && g.images.length > 0 && (
          <button
            className="link-btn"
            onClick={async () => {
              await g.newRound()
              g.toast('Đã bắt đầu một vòng mới.')
            }}
          >
            Bắt đầu lại vòng mới ngay (vòng hiện tại: {g.bag.round})
          </button>
        )}
      </fieldset>

      <fieldset className="setting">
        <legend>Chuyển động</legend>
        <Radio<MotionPref>
          name="motion"
          value={s.motion}
          onChange={(motion) => g.updateSettings({ motion })}
          options={[
            ['system', 'Theo thiết bị', 'Tự giảm chuyển động nếu thiết bị đang bật tuỳ chọn này.'],
            ['reduce', 'Giảm chuyển động', 'Bỏ vòng lướt, chỉ chuyển cảnh ngắn.'],
            ['full', 'Đầy đủ', 'Luôn chạy hiệu ứng lướt và mở pixel.'],
          ]}
        />
      </fieldset>

      <fieldset className="setting">
        <legend>Cảm giác</legend>
        <Toggle
          label="Tiếng chuông khi ảnh hiện rõ"
          hint="Một tiếng chime rất nhẹ, tạo bằng Web Audio."
          checked={s.sound}
          onChange={(sound) => {
            if (sound) {
              unlockAudio()
              setTimeout(chime, 60)
            }
            g.updateSettings({ sound })
          }}
        />
        <Toggle
          label="Rung nhẹ"
          hint="Chỉ có tác dụng trên thiết bị hỗ trợ (đa số Android)."
          checked={s.haptics}
          onChange={(haptics) => g.updateSettings({ haptics })}
        />
      </fieldset>

      <fieldset className="setting">
        <legend>Dữ liệu trên thiết bị này</legend>
        <p className="small">
          {g.images.length} ảnh · khoảng {fmtBytes(imagesBytes)} ảnh gốc
          {est && est.quota > 0 && ` · trình duyệt đang dùng ${fmtBytes(est.usage)} / ${fmtBytes(est.quota)}`}
        </p>
        <p className="small muted">
          Ảnh nằm trong IndexedDB của trình duyệt này
          {est?.persisted ? ' và đã được đánh dấu lưu lâu dài.' : '.'} Không có bản sao trên máy chủ. Trên iPhone,
          Safari có thể xoá dữ liệu của trang web không được mở trong một thời gian dài — thêm app vào Màn hình chính
          giúp giữ dữ liệu ổn định hơn.
        </p>
        <button
          className="btn btn-danger-ghost btn-sm"
          disabled={g.images.length === 0}
          onClick={() =>
            confirm({
              title: 'Xoá toàn bộ dữ liệu?',
              body: `Tất cả ${g.images.length} ảnh, lịch sử đón nhận và cài đặt trên thiết bị này sẽ bị xoá vĩnh viễn.`,
              confirmLabel: 'Xoá tất cả',
              onConfirm: async () => {
                await g.clearAll()
                g.toast('Đã xoá toàn bộ dữ liệu trên thiết bị này.')
              },
            })
          }
        >
          Xoá toàn bộ dữ liệu
        </button>
      </fieldset>
    </Sheet>
  )
}

function Radio<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string
  value: T
  onChange: (v: T) => void
  options: [T, string, string][]
}) {
  return (
    <div className="radio-group">
      {options.map(([v, label, hint]) => (
        <label key={v} className={`radio ${value === v ? 'is-on' : ''}`}>
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} />
          <span className="radio-dot" aria-hidden="true" />
          <span>
            <span className="radio-label">{label}</span>
            <span className="small muted block">{hint}</span>
          </span>
        </label>
      ))}
    </div>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <span>
        <span className="radio-label">{label}</span>
        <span className="small muted block">{hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" aria-hidden="true" />
    </label>
  )
}
