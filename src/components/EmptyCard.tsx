/** Card bí ẩn vẽ bằng SVG cho trạng thái chưa có ảnh — không phải dữ liệu giả. */
export function EmptyCard() {
  return (
    <div className="hero-card empty-card" aria-hidden="true">
      <svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" className="empty-svg">
        <defs>
          <radialGradient id="eg-glow" cx="50%" cy="46%" r="55%">
            <stop offset="0%" stopColor="#2C6957" stopOpacity="0.55" />
            <stop offset="60%" stopColor="#2C6957" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#2C6957" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="eg-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E9D5A6" />
            <stop offset="100%" stopColor="#B99A5E" />
          </linearGradient>
          <pattern id="eg-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="none" stroke="#D8BE87" strokeOpacity="0.045" />
          </pattern>
        </defs>
        <rect width="300" height="400" fill="#0E1512" />
        <rect width="300" height="400" fill="url(#eg-grid)" />
        <rect width="300" height="400" fill="url(#eg-glow)" />
        {/* Cổng vòm khu vườn */}
        <path
          d="M90 318V172a60 60 0 0 1 120 0v146"
          stroke="url(#eg-gold)"
          strokeWidth="1"
          fill="none"
          opacity="0.75"
        />
        <path
          d="M102 318V176a48 48 0 0 1 96 0v142"
          stroke="#D8BE87"
          strokeWidth="0.6"
          fill="none"
          opacity="0.35"
        />
        <line x1="70" y1="318" x2="230" y2="318" stroke="#D8BE87" strokeOpacity="0.4" strokeWidth="0.8" />
        {/* Viên ngọc */}
        <g transform="translate(150 200)" className="empty-gem">
          <path d="M-22 -8 -12 -20h24l10 12L0 26Z" fill="#2C6957" fillOpacity="0.28" stroke="url(#eg-gold)" strokeWidth="1" />
          <path d="M-22 -8h44M-12 -20 0 26M12 -20 0 26M-12 -20-4-8M12 -20 4-8" stroke="#D8BE87" strokeOpacity="0.55" strokeWidth="0.6" fill="none" />
        </g>
        {/* Hạt sáng */}
        {[
          [72, 96, 1.4],
          [228, 120, 1],
          [118, 70, 0.8],
          [196, 262, 1.2],
          [84, 250, 0.9],
          [240, 330, 1.1],
          [150, 128, 1.6],
        ].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="#F2E3BD" className="empty-dot" style={{ animationDelay: `${i * 0.7}s` }} />
        ))}
      </svg>
    </div>
  )
}
