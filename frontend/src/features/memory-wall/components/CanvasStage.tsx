import type { ReactNode } from 'react'
import { memoryWallAssets } from '@/assets/memoryWall'

interface CanvasStageProps {
  /** Current wall paint (scene.wall.paintHex), so the room around the wall matches it. */
  paintHex: string
  children: ReactNode
}

/**
 * SAF-only presentation. The wall canvas keeps the wall's own aspect ratio (Moonlight behaviour), so
 * on wide panels it's narrower than the panel. Instead of blank white strips beside it (audit,
 * Phase 4), the canvas sits on a "room stage": the same room photo (same URL as the one inside the
 * SVG, so no extra download) tinted by the paint colour and softly blurred, as in the mockup where
 * the wall sits inside the photographed room. Decorative; never exported (the PNG is the SVG only).
 */
export function CanvasStage({ paintHex, children }: CanvasStageProps) {
  const room = memoryWallAssets.roomBackground
  return (
    <div className="relative isolate overflow-hidden rounded-field">
      <div aria-hidden className="absolute inset-0 -z-10" style={{ backgroundColor: paintHex }}>
        <img
          src={room.src}
          width={room.width}
          height={room.height}
          alt=""
          decoding="async"
          draggable={false}
          className="size-full scale-110 object-cover object-bottom opacity-90 mix-blend-multiply blur-md select-none"
        />
        <div className="absolute inset-0 bg-surface/20" />
      </div>
      {children}
    </div>
  )
}
