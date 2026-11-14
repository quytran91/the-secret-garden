import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 20, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const IconHeart = ({ filled, ...p }: P & { filled?: boolean }) => (
  <Svg {...p}>
    <path
      d="M12 20s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.3C19.5 15.4 12 20 12 20Z"
      fill={filled ? 'currentColor' : 'none'}
    />
  </Svg>
)
export const IconExpand = (p: P) => (
  <Svg {...p}>
    <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
  </Svg>
)
export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
)
export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)
export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.8 12.2h9.4l.8-12.2" />
  </Svg>
)
export const IconPen = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 19.5h4l10-10-4-4-10 10v4ZM13 7l4 4" />
  </Svg>
)
export const IconZoomIn = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2M11 8.2v5.6M8.2 11h5.6" />
  </Svg>
)
export const IconZoomOut = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2M8.2 11h5.6" />
  </Svg>
)
export const IconSpark = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5c.6 4.2 2.3 5.9 6.5 6.5-4.2.6-5.9 2.3-6.5 6.5-.6-4.2-2.3-5.9-6.5-6.5 4.2-.6 5.9-2.3 6.5-6.5Z" />
  </Svg>
)

/** Dấu ấn nhỏ cạnh wordmark: hình thoi viên ngọc, nét mảnh */
export const Sigil = (p: P) => (
  <Svg {...p} strokeWidth={1.1}>
    <path d="M6 8.5 9 5h6l3 3.5L12 19 6 8.5Z" />
    <path d="M6 8.5h12M9 5l3 14M15 5l-3 14" opacity={0.6} />
  </Svg>
)

export const IconSound = (p: P) => (
  <Svg {...p} strokeWidth={2}>
    <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4v-5Z" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </Svg>
)
export const IconMute = (p: P) => (
  <Svg {...p} strokeWidth={2}>
    <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4v-5Z" />
    <path d="m16 9.5 5 5M21 9.5l-5 5" />
  </Svg>
)
