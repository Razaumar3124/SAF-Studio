import type { LayoutStyleId } from '../constants'

/**
 * SAF-only: the line-drawn layout schematics from the "Layout Selection" tiles in the mockup
 * (ASSETS.md A13: drawn in code, no asset needed). Decorative; the tile label names the style.
 */
const SHAPES: Record<LayoutStyleId, ReadonlyArray<readonly [number, number, number, number]>> = {
  grid: [
    [2, 2, 12, 8],
    [16, 2, 12, 8],
    [30, 2, 12, 8],
    [2, 12, 12, 8],
    [16, 12, 12, 8],
    [30, 12, 12, 8],
  ],
  salon: [
    [2, 6, 8, 12],
    [12, 3, 10, 8],
    [12, 13, 7, 7],
    [24, 2, 8, 10],
    [21, 14, 11, 6],
    [34, 7, 8, 9],
  ],
  centre: [
    [2, 6, 8, 10],
    [12, 2, 20, 18],
    [34, 6, 8, 10],
  ],
  row: [
    [2, 5, 12, 12],
    [16, 5, 12, 12],
    [30, 5, 12, 12],
  ],
}

export function LayoutStyleIcon({ style }: { style: LayoutStyleId }) {
  return (
    <svg viewBox="0 0 44 22" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
      {SHAPES[style].map(([x, y, w, h]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx="0.8" />
      ))}
    </svg>
  )
}
