/**
 * Pixel art tự vẽ bằng SVG (mỗi ký tự = 1 ô). Nhẹ, sắc nét ở mọi kích thước.
 */
import { memo, type CSSProperties, type ReactElement } from 'react'

type Palette = Record<string, string>

function PixelArt({
  rows,
  palette,
  size,
  className,
  style,
  title,
}: {
  rows: string[]
  palette: Palette
  size?: number
  className?: string
  style?: CSSProperties
  title?: string
}) {
  const w = rows[0].length
  const h = rows.length
  const rects: ReactElement[] = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const c = row[x]
      let run = 1
      while (x + run < row.length && row[x + run] === c) run++
      if (palette[c]) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={run} height={1} fill={palette[c]} />)
      x += run
    }
  })
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={size ? (size * w) / Math.max(w, h) : undefined}
      height={size ? (size * h) / Math.max(w, h) : undefined}
      shapeRendering="crispEdges"
      className={className}
      style={style}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {rects}
    </svg>
  )
}

/* Kim cương pixel — biểu tượng nhận diện */
const DIAMOND = [
  '....OOOOOOO....',
  '...OWLLMLLDO...',
  '..OWLLMMMLLDDO.',
  '.OWLLMMMMMLLDDO',
  'OOOOOOOOOOOOOOO',
  'OLLMMMMDDDDDDDO',
  '.OLMMMMDDDDDDO.',
  '..OLMMMDDDDDO..',
  '...OLMMDDDDO...',
  '....OLMDDDO....',
  '.....OLDDO.....',
  '......OLO......',
  '.......O.......',
]
const DIAMOND_PAL: Palette = { O: '#0B2A66', W: '#FFFFFF', L: '#9EE8FF', M: '#3FA9F5', D: '#1D5FD1' }

export const PixelDiamond = memo(function PixelDiamond(props: { size?: number; className?: string; style?: CSSProperties; title?: string }) {
  return <PixelArt rows={DIAMOND} palette={DIAMOND_PAL} {...props} />
})

/* Mây pixel */
const CLOUD = [
  '..........WWWW..........',
  '......WWWWWWWWWW........',
  '.....WWWWWWWWWWWW..WWW..',
  '...WWWWWWWWWWWWWWWWWWWW.',
  '.WWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWW',
  'SSSSWWWWWWWWWWWWWWWWSSSS',
  '.SSSSSSSSSSSSSSSSSSSSSS.',
]
export const PixelCloud = memo(function PixelCloud(props: { className?: string; style?: CSSProperties }) {
  return <PixelArt rows={CLOUD} palette={{ W: '#FFFFFF', S: '#D6EEFF' }} {...props} />
})

/* Cây dừa pixel */
const PALM = [
  '...GG.......GG...',
  '..GGGG.GGG.GGGG..',
  '.GGHGGGGGGGGGHGG.',
  'GGG..GGHHHGG..GGG',
  'GG..GGG.T.GGG..GG',
  'G..GG...T...GG..G',
  '...G....T....G...',
  '........TT.......',
  '........TT.......',
  '.........T.......',
  '.........TT......',
  '.........TT......',
  '..........T......',
  '..........TT.....',
  '..........TT.....',
  '..........TT.....',
]
export const PixelPalm = memo(function PixelPalm(props: { className?: string; style?: CSSProperties }) {
  return <PixelArt rows={PALM} palette={{ G: '#1E9E4A', H: '#5ED36A', T: '#7A4A21' }} {...props} />
})

/* Tia sáng pixel nhỏ (hình chữ thập) */
export const PixelSpark = memo(function PixelSpark(props: { className?: string; style?: CSSProperties }) {
  return <PixelArt rows={['.Y.', 'YWY', '.Y.']} palette={{ Y: '#FFD84A', W: '#FFFFFF' }} {...props} />
})
