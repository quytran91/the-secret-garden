import { PixelDiamond, PixelSpark } from './Pixel'

/** Card trống: viên kim cương pixel lớn trong cổng kho báu — không phải dữ liệu giả. */
export function EmptyCard() {
  return (
    <div className="hero-card empty-card" aria-hidden="true">
      <div className="empty-stars">
        {[
          [14, 18],
          [78, 12],
          [86, 64],
          [10, 72],
          [52, 86],
          [64, 30],
        ].map(([x, y], i) => (
          <PixelSpark key={i} className="empty-star" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.6}s` }} />
        ))}
      </div>
      <PixelDiamond size={150} className="empty-gem" />
      <div className="empty-shadow" />
    </div>
  )
}
