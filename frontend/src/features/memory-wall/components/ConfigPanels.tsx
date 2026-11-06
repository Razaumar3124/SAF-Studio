import { Columns3, LayoutPanelTop, PanelsTopLeft, Sparkles } from 'lucide-react'
import type { Dispatch } from 'react'
import { NumberStepper } from '@/components/ui/NumberStepper'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SwatchPicker } from '@/components/ui/SwatchPicker'
import { cn } from '@/lib/cn'
import { roundTo, type LengthUnit } from '@/lib/units'
import {
  AI_LAYOUT_PRESETS,
  GAP_UNITS,
  LAYOUT_STYLES,
  PAINT_SHADES,
  PLANNER_RULES,
  WALL_UNITS,
  type GapUnit,
  type LayoutStyleId,
} from '../constants'
import type { PlannerAction, PlannerState } from '../lib/plannerState'
import { findTemplate, type PlannerTemplate } from '../lib/templates'
import { DimensionInput } from './DimensionInput'
import { LayoutStyleIcon } from './LayoutStyleIcon'
import { StepCard } from './StepCard'

interface PanelProps {
  state: PlannerState
  dispatch: Dispatch<PlannerAction>
  collapsible?: boolean
}

/* ① Wall Configuration (same controls and actions as Moonlight) */
export function WallConfigPanel({ state, dispatch, collapsible }: PanelProps) {
  const paint = PAINT_SHADES.find((p) => p.id === state.wall.paintId)
  return (
    <StepCard step={1} icon={<PanelsTopLeft />} title="Wall Configuration" collapsible={collapsible}>
      {/*
        Container-driven so it fits any card width (audit: the one-row layout used to squeeze the
        inputs at ~45rem): stacked < 26rem; dimensions | unit, swatches below, from 26rem (the desk grid's
        5-column card at 1256–1440px); the mockup's single row (dimensions | swatches | unit) only from 56rem.
      */}
      <div className="@container">
        <div className="grid gap-4 desk:gap-3 @[26rem]:grid-cols-[minmax(0,1fr)_auto] @[26rem]:gap-x-5 @4xl:grid-cols-[minmax(14rem,1fr)_auto_auto] @4xl:items-start">
          <div className="grid grid-cols-2 gap-3">
            <DimensionInput
              label="Wall Width"
              valueIn={state.wall.widthIn}
              unit={state.displayUnit}
              minIn={PLANNER_RULES.wallWidthIn.min}
              maxIn={PLANNER_RULES.wallWidthIn.max}
              onCommit={(value) => dispatch({ type: 'wall/setSize', dimension: 'widthIn', value })}
            />
            <DimensionInput
              label="Wall Height"
              valueIn={state.wall.heightIn}
              unit={state.displayUnit}
              minIn={PLANNER_RULES.wallHeightIn.min}
              maxIn={PLANNER_RULES.wallHeightIn.max}
              onCommit={(value) => dispatch({ type: 'wall/setSize', dimension: 'heightIn', value })}
            />
          </div>
          <SwatchPicker
            label="Paint Shade"
            options={PAINT_SHADES}
            value={state.wall.paintId}
            onChange={(paintId) => dispatch({ type: 'wall/setPaint', paintId })}
            aside={paint?.label}
            className="@[26rem]:order-last @[26rem]:col-span-2 @4xl:order-none @4xl:col-span-1 @4xl:border-l @4xl:border-line @4xl:pl-5"
          />
          <SegmentedControl<LengthUnit>
            label="Measurement Unit"
            showLabel
            options={WALL_UNITS.map((u) => ({ value: u, label: u }))}
            value={state.displayUnit}
            onChange={(unit) => dispatch({ type: 'unit/set', unit })}
            className="@[26rem]:min-w-40 @[26rem]:border-l @[26rem]:border-line @[26rem]:pl-5"
          />
        </div>
      </div>
    </StepCard>
  )
}

/* ② Layout Selection: style tiles + Number of Frames (kept from Moonlight, PORTING_PARITY D2) */
export function LayoutPanel({ state, dispatch, collapsible }: PanelProps) {
  return (
    <StepCard step={2} icon={<LayoutPanelTop />} title="Layout Selection" collapsible={collapsible}>
      <SegmentedControl<LayoutStyleId>
        label="Layout style"
        variant="tiles"
        options={LAYOUT_STYLES.map((s) => ({
          value: s.id,
          label: s.label,
          icon: <LayoutStyleIcon style={s.id} />,
        }))}
        value={state.layout.style}
        onChange={(style) => dispatch({ type: 'layout/setStyle', style })}
      />
      <NumberStepper
        label="Number of Frames"
        value={state.frames.length}
        min={PLANNER_RULES.frameCount.min}
        max={PLANNER_RULES.frameCount.max}
        step={1}
        precision={0}
        onChange={(count) => dispatch({ type: 'frames/setCount', count })}
      />
    </StepCard>
  )
}

/* Frame Gaps: Moonlight's gap stepper + in/cm unit (part of its Layout panel; a card of its own in SAF) */
export function FrameGapsPanel({ state, dispatch, collapsible }: PanelProps) {
  const { gapIn, gapUnit } = state.layout
  const inCm = gapUnit === 'cm'
  const shown = inCm ? roundTo(gapIn * 2.54, 1) : gapIn
  return (
    <StepCard icon={<Columns3 />} title="Frame Gaps" collapsible={collapsible}>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3">
        <NumberStepper
          label="Frame gap"
          hideLabel
          value={shown}
          min={0}
          max={inCm ? roundTo(PLANNER_RULES.gapIn.max * 2.54, 0) : PLANNER_RULES.gapIn.max}
          step={inCm ? 1 : 0.5}
          precision={1}
          onChange={(v) => dispatch({ type: 'layout/setGap', gapIn: inCm ? v / 2.54 : v })}
        />
        <SegmentedControl<GapUnit>
          label="Gap unit"
          size="sm"
          options={GAP_UNITS.map((u) => ({ value: u, label: u }))}
          value={gapUnit}
          onChange={(unit) => dispatch({ type: 'layout/setGapUnit', unit })}
        />
      </div>
    </StepCard>
  )
}

/* ✦ "Need a little inspiration?" (Moonlight's AI Layout Assistant: same presets and templates) */
export function AiAssistantPanel({
  state,
  onApplyTemplate,
  collapsible,
}: Omit<PanelProps, 'dispatch'> & { onApplyTemplate: (template: PlannerTemplate) => void }) {
  return (
    <StepCard
      icon={<Sparkles />}
      title="Need a little inspiration?"
      subtitle="Explore intelligent arrangements tailored to your space."
      collapsible={collapsible}
    >
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {AI_LAYOUT_PRESETS.map((preset) => {
          const active = state.templateId === preset.templateId
          return (
            <li key={preset.templateId}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => {
                  const template = findTemplate(preset.templateId)
                  if (template) onApplyTemplate(template)
                }}
                className={cn(
                  'group flex w-full flex-col overflow-hidden rounded-field border bg-surface text-center shadow-field transition-[border-color,transform,box-shadow]',
                  'hover:-translate-y-0.5 hover:shadow-card',
                  active ? 'border-brand-600 ring-1 ring-brand-600' : 'border-line',
                )}
              >
                <img
                  src={preset.thumbnail.src}
                  width={preset.thumbnail.width}
                  height={preset.thumbnail.height}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="aspect-[750/423] w-full object-cover"
                />
                <span
                  className={cn(
                    'px-1.5 py-2 text-xs leading-tight sm:text-sm desk:py-1.5',
                    active ? 'bg-brand-50 font-semibold text-brand-800' : 'text-ink-700',
                  )}
                >
                  {preset.label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </StepCard>
  )
}
