import { memo, useId, type KeyboardEvent, type Ref } from 'react'
import { memoryWallAssets } from '@/assets/memoryWall'
import { ROOM_PHOTO } from '../constants'
import type { Scene, SceneFrame } from '../lib/geometry/scene'

interface WallSvgProps {
  scene: Scene
  /** Frames become focusable buttons that report clicks. */
  interactive?: boolean
  selectedIndex?: number
  onSelect?: (index: number) => void
  /** Animate frames to new positions when the layout recalculates. */
  animate?: boolean
  /** Lighter rendering for thumbnails (no shadows/sheen). */
  detail?: 'full' | 'low'
  svgRef?: Ref<SVGSVGElement>
  className?: string
  /** Accessible description of the whole wall. */
  title?: string
}

/**
 * SAF room photo (memory-wall.png, 1860×846): an empty sunlit room, NO sofa. Only the part above the
 * floor line (y ≈ 715px) is drawn, bottom-aligned to the wall's floor, as a light/texture layer.
 */
const ROOM_PX = { width: 1860, floorY: 715 } as const

/**
 * Pure SVG rendering of a Scene. The viewBox is the wall in inches, so every rect from the
 * geometry engine is drawn 1:1 and the browser handles scaling. Only presentation attributes
 * (no CSS classes) are used for visuals, so a clone of this SVG can be exported as a PNG.
 *
 * SAF presentation (geometry unchanged): the room photo is multiplied over the paint colour on the
 * whole wall (sunlight, window and arch at the edges; Paint Shade still tints it). The 84″ reference
 * sofa, a photo element in Moonlight, is drawn as a vector to scale, its back exactly at
 * `scene.sofaTopY` (the same value the layout keeps its clearance from), because SAF's photo has no
 * sofa (ASSETS.md A9).
 */
function WallSvgImpl({
  scene,
  interactive = false,
  selectedIndex = -1,
  onSelect,
  animate = false,
  detail = 'full',
  svgRef,
  className,
  title,
}: WallSvgProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const id = (name: string) => `${uid}-${name}`
  const { w: W, h: H, paintHex } = scene.wall
  const full = detail === 'full'

  const onKey = (index: number) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect?.(index)
    }
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      role={interactive ? 'group' : 'img'}
      aria-label={title}
    >
      <defs>
        {/* Soft daylight from the room photo's window side (top left). */}
        <radialGradient id={id('light')} cx="0.12" cy="0.05" r="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="0.6" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="1" stopColor="#231709" stopOpacity="0.05" />
        </radialGradient>
        <linearGradient id={id('sheen')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </linearGradient>
        <linearGradient id={id('sofaShade')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="1" stopColor="#231709" stopOpacity="0.12" />
        </linearGradient>
        <filter id={id('shadow')} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0.35" dy="0.9" stdDeviation="0.9" floodColor="#231709" floodOpacity="0.32" />
        </filter>
      </defs>

      {/* Wall: paint colour, with the SAF room photo multiplied over it (light, shadows, window and
          arch at the edges), bottom-aligned so its skirting sits on the floor line. */}
      <rect width={W} height={H} fill={paintHex} />
      <g style={{ mixBlendMode: 'multiply' }}>
        <svg
          x={0}
          y={0}
          width={W}
          height={H}
          viewBox={`0 0 ${ROOM_PX.width} ${ROOM_PX.floorY}`}
          preserveAspectRatio="xMidYMax slice"
        >
          <image
            href={memoryWallAssets.roomBackground.src}
            width={memoryWallAssets.roomBackground.width}
            height={memoryWallAssets.roomBackground.height}
          />
        </svg>
      </g>
      <rect width={W} height={H} fill={`url(#${id('light')})`} />

      {/* 84" reference sofa (Preview Settings), drawn to scale at the geometry's sofa line. */}
      {scene.sofaTopY !== null && (
        <ReferenceSofa wallWidth={W} floorY={H} topY={scene.sofaTopY} shade={id('sofaShade')} />
      )}

      {/* Frames */}
      {scene.frames.map((f, i) => (
        <FrameShape
          key={f.id}
          frame={f}
          ids={{ sheen: id('sheen'), shadow: id('shadow') }}
          full={full}
          animate={animate}
          selected={i === selectedIndex}
          interactive={interactive}
          onClick={() => onSelect?.(i)}
          onKeyDown={onKey(i)}
        />
      ))}
    </svg>
  )
}

interface FrameShapeProps {
  frame: SceneFrame
  ids: { sheen: string; shadow: string }
  full: boolean
  animate: boolean
  selected: boolean
  interactive: boolean
  onClick: () => void
  onKeyDown: (e: KeyboardEvent<SVGGElement>) => void
}

function FrameShape({
  frame,
  ids,
  full,
  animate,
  selected,
  interactive,
  onClick,
  onKeyDown,
}: FrameShapeProps) {
  const { outer, inner, photoRect } = frame
  const w = outer.w
  const h = outer.h
  // Local coordinates (the group is translated to the frame's position).
  const ix = inner.x - outer.x
  const iy = inner.y - outer.y
  const px = photoRect.x - outer.x
  const py = photoRect.y - outer.y
  const plus = Math.min(photoRect.w, photoRect.h) * 0.16

  return (
    <g
      data-tx={outer.x}
      data-ty={outer.y}
      transform={`translate(${outer.x} ${outer.y})`}
      style={{
        transform: `translate(${outer.x}px, ${outer.y}px)`,
        transition: animate ? 'transform 480ms cubic-bezier(0.2, 0.8, 0.2, 1)' : undefined,
      }}
      className={interactive ? 'wall-frame' : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? frame.label : undefined}
      aria-pressed={interactive ? selected : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={interactive ? onKeyDown : undefined}
    >
      {/* Moulding */}
      <rect
        width={w}
        height={h}
        rx={0.12}
        fill={frame.finishHex}
        filter={full ? `url(#${ids.shadow})` : undefined}
      />
      {full && <rect width={w} height={h} rx={0.12} fill={`url(#${ids.sheen})`} />}
      {/* Mount board */}
      {frame.mountHex && <rect x={ix} y={iy} width={inner.w} height={inner.h} fill={frame.mountHex} />}
      {full && (
        <rect
          x={ix}
          y={iy}
          width={inner.w}
          height={inner.h}
          fill="none"
          stroke="#000"
          strokeOpacity="0.22"
          strokeWidth={0.14}
        />
      )}
      {/* Photo or empty slot */}
      {frame.photo ? (
        <>
          <image
            href={frame.photo.href}
            x={px}
            y={py}
            width={photoRect.w}
            height={photoRect.h}
            preserveAspectRatio="xMidYMid slice"
            opacity={frame.photo.isFill ? 0.92 : 1}
          />
          {frame.mountHex && full && (
            <rect
              x={px}
              y={py}
              width={photoRect.w}
              height={photoRect.h}
              fill="none"
              stroke="#fff"
              strokeOpacity="0.5"
              strokeWidth={0.1}
            />
          )}
        </>
      ) : (
        <g>
          <rect x={px} y={py} width={photoRect.w} height={photoRect.h} fill="#f3ede4" />
          <rect
            x={px + 0.4}
            y={py + 0.4}
            width={Math.max(0, photoRect.w - 0.8)}
            height={Math.max(0, photoRect.h - 0.8)}
            fill="none"
            stroke="#9e8c7a"
            strokeWidth={0.12}
            strokeDasharray="0.6 0.45"
          />
          <path
            d={`M${px + photoRect.w / 2 - plus} ${py + photoRect.h / 2}h${plus * 2}M${px + photoRect.w / 2} ${py + photoRect.h / 2 - plus}v${plus * 2}`}
            stroke="#9e8c7a"
            strokeWidth={Math.max(0.15, plus * 0.18)}
            strokeLinecap="round"
          />
        </g>
      )}
      {/* Selection + keyboard focus (UI only, never exported) */}
      {interactive && (
        <g data-export="exclude">
          <rect
            className="wall-frame-focus"
            x={-1.4}
            y={-1.4}
            width={w + 2.8}
            height={h + 2.8}
            rx={0.6}
            fill="none"
            stroke="#231709"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            strokeDasharray="4 3"
          />
          {selected && (
            <rect
              x={-0.9}
              y={-0.9}
              width={w + 1.8}
              height={h + 1.8}
              rx={0.5}
              fill="none"
              stroke="#f2a428"
              strokeWidth={3}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </g>
      )}
    </g>
  )
}

/**
 * SAF-only: the 84″ reference sofa as a to-scale vector (inches). Moonlight's room photo contained the
 * sofa; SAF's doesn't. Width is Moonlight's ROOM_PHOTO.sofaWidthIn, the top of the back is the
 * geometry's `sofaTopY`, so the frames' sofa clearance is measured from exactly what's drawn.
 * Presentation attributes only (exportable). Linen upholstery, oak legs.
 */
function ReferenceSofa({
  wallWidth,
  floorY,
  topY,
  shade,
}: {
  wallWidth: number
  floorY: number
  topY: number
  shade: string
}) {
  const width = ROOM_PHOTO.sofaWidthIn
  const height = Math.max(0, floorY - topY)
  if (height <= 0) return null
  const x = wallWidth / 2 - width / 2
  const leg = Math.min(3, height * 0.12)
  const body = height - leg
  const arm = Math.min(7, width * 0.08)
  const seatTop = topY + body * 0.5
  const fabric = '#d8d2c6'
  const fabricDark = '#c5bdaf'
  return (
    <g aria-hidden data-sofa="">
      {/* Floor shadow */}
      <ellipse
        cx={wallWidth / 2}
        cy={floorY - 0.4}
        rx={width * 0.52}
        ry={1.2}
        fill="#231709"
        fillOpacity="0.12"
      />
      {/* Legs */}
      {[x + arm * 0.6, x + width - arm * 0.6].map((lx) => (
        <rect key={lx} x={lx - 0.6} y={floorY - leg} width={1.2} height={leg} rx={0.3} fill="#7a5a3c" />
      ))}
      {/* Back */}
      <rect
        x={x + arm * 0.6}
        y={topY}
        width={width - arm * 1.2}
        height={body * 0.62}
        rx={2.2}
        fill={fabricDark}
      />
      {/* Seat cushions */}
      {[0, 1, 2].map((i) => {
        const cw = (width - arm * 2) / 3
        return (
          <rect
            key={i}
            x={x + arm + i * cw + 0.2}
            y={seatTop}
            width={cw - 0.4}
            height={body * 0.3}
            rx={1.4}
            fill={fabric}
          />
        )
      })}
      {/* Base */}
      <rect
        x={x + arm * 0.5}
        y={seatTop + body * 0.28}
        width={width - arm}
        height={body * 0.22}
        rx={1}
        fill={fabricDark}
      />
      {/* Arms */}
      <rect x={x} y={topY + body * 0.3} width={arm} height={body * 0.7} rx={2} fill={fabric} />
      <rect x={x + width - arm} y={topY + body * 0.3} width={arm} height={body * 0.7} rx={2} fill={fabric} />
      <rect x={x} y={topY} width={width} height={body} rx={2} fill={`url(#${shade})`} />
    </g>
  )
}

/** Memoised: thumbnails re-render only when their scene changes. */
export const WallSvg = memo(WallSvgImpl)
