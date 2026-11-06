import {
  Bookmark,
  CircleAlert,
  CircleCheck,
  LayoutGrid,
  RefreshCw,
  RotateCcw,
  WandSparkles,
} from 'lucide-react'
import { useCallback, type Dispatch, type Ref } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatLength } from '@/lib/units'
import type { Scene } from '../lib/geometry/scene'
import type { PlannerAction, PlannerState } from '../lib/plannerState'
import { CanvasStage } from './CanvasStage'
import { WallCanvas } from './WallCanvas'

interface CanvasPanelProps {
  state: PlannerState
  dispatch: Dispatch<PlannerAction>
  scene: Scene
  svgRef: Ref<SVGSVGElement>
  generating: boolean
  onSave: () => void
  onReset: () => void
  onGenerate: () => void
  onRegenerate: () => void
  onRedesign: () => void
}

/**
 * The live wall plus everything that changes the arrangement. Same props, handlers and live
 * summary as Moonlight; SAF composition from the mockup: one toolbar row (Save/Reset ·
 * Regenerate/Redesign/Generate) above the canvas, status beneath it.
 */
export function CanvasPanel({
  state,
  dispatch,
  scene,
  svgRef,
  generating,
  onSave,
  onReset,
  onGenerate,
  onRegenerate,
  onRedesign,
}: CanvasPanelProps) {
  const unit = state.displayUnit
  const a = scene.arrangement
  // Stable callback, so the memoised WallSvg skips renders that don't change the drawing.
  const onSelect = useCallback((index: number) => dispatch({ type: 'frames/select', index }), [dispatch])

  return (
    <section
      aria-labelledby="canvas-title"
      className="flex min-w-0 flex-col gap-3 rounded-card border border-line/80 bg-surface p-2.5 shadow-card sm:p-3.5"
    >
      <h2 id="canvas-title" className="sr-only">
        Generated Layout
      </h2>

      {/* Toolbar: one row from desk (mockup); wraps into rows on smaller screens. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Phones: tidy 2-column grid (full-width Generate); from sm, the mockup's toolbar row. */}
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
          <Button
            variant="secondary"
            size="md"
            className="h-9 px-3"
            leftIcon={<Bookmark aria-hidden className="size-4" />}
            onClick={onSave}
          >
            Save <span className="hidden sm:inline">Design</span>
          </Button>
          <Button
            variant="secondary"
            size="md"
            className="h-9 px-3"
            leftIcon={<RotateCcw aria-hidden className="size-4" />}
            onClick={onReset}
          >
            Reset
          </Button>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end desk:flex-nowrap">
          <Button
            variant="secondary"
            size="md"
            className="h-9 px-3"
            title="Same style, new arrangement"
            leftIcon={<RefreshCw aria-hidden className="size-4" />}
            onClick={onRegenerate}
          >
            Regenerate
          </Button>
          <Button
            variant="secondary"
            size="md"
            className="h-9 px-3"
            title="Try a different composition"
            leftIcon={<WandSparkles aria-hidden className="size-4" />}
            onClick={onRedesign}
          >
            Redesign
          </Button>
          <Button
            size="md"
            className="col-span-2 h-10 px-3 sm:h-9"
            leftIcon={<LayoutGrid aria-hidden className="size-4" />}
            loading={generating}
            loadingText="Finding the best layout…"
            onClick={onGenerate}
          >
            Generate Layout
          </Button>
        </div>
      </div>

      <CanvasStage paintHex={scene.wall.paintHex}>
        <WallCanvas
          scene={scene}
          unit={unit}
          showGuides={state.preview.guides}
          showBadges={state.preview.indexBadges}
          interactive
          selectedIndex={state.selectedIndex}
          onSelect={onSelect}
          svgRef={svgRef}
          // Fills the viewport under the brand bar minus the panel's toolbar, status line and padding
          // (≈ 9rem), so toolbar + wall + status fit one screen (1280×720: 496px tall); never smaller than
          // the former 62vh, never taller than 52rem.
          maxHeight="min(max(62vh, 100dvh - var(--bar-h) - 10rem), 52rem)"
          className="shadow-card"
        />
      </CanvasStage>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-1">
        {scene.fits ? (
          <Badge tone="success">
            <CircleCheck aria-hidden /> Fits wall
          </Badge>
        ) : (
          <Badge tone="warning">
            <CircleAlert aria-hidden /> Check fit
          </Badge>
        )}
        {/* Live summary: announced politely so screen-reader users hear layout changes. */}
        <p aria-live="polite" className="text-center text-xs text-ink-600 sm:text-sm">
          Arrangement {formatLength(a.w, unit === 'ft' ? 'in' : unit)} ×{' '}
          {formatLength(a.h, unit === 'ft' ? 'in' : unit)} · {scene.frames.length}{' '}
          {scene.frames.length === 1 ? 'frame' : 'frames'} · covers {Math.round(scene.coverage * 100)}% of the
          wall
        </p>
      </div>
      {scene.warnings.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {scene.warnings.map((w) => (
            <li
              key={w.code}
              className="flex items-start gap-2 rounded-field border border-gold-300 bg-gold-100/60 px-3 py-2 text-sm text-ink-700"
            >
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-600" />
              {w.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
