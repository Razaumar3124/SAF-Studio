import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface StepCardProps {
  /**
   * Moonlight's step number. SAF panels are unnumbered (the steps live in the hero StepStrip,
   * PORTING_PARITY D10), so it's announced to screen readers only ("Step 1: …").
   */
  step?: number
  icon?: ReactNode
  title: string
  subtitle?: string
  badge?: ReactNode
  /** Header controls on the right (when not collapsible). */
  actions?: ReactNode
  /** Header becomes a disclosure button (accordion on phones, "Preview Settings" everywhere). */
  collapsible?: boolean
  defaultOpen?: boolean
  className?: string
  bodyClassName?: string
  children: ReactNode
}

/** Planner panel (SAF): mist card, icon disc + navy title. Same props and disclosure as Moonlight. */
export function StepCard({
  step,
  icon,
  title,
  subtitle,
  badge,
  actions,
  collapsible = false,
  defaultOpen = true,
  className,
  bodyClassName,
  children,
}: StepCardProps) {
  const [open, setOpen] = useState(defaultOpen)
  const titleId = useId()
  const bodyId = useId()
  const expanded = !collapsible || open

  const heading = (
    <span className="flex min-w-0 items-center gap-2.5 text-left">
      {icon && (
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-brand-700 shadow-field [&>svg]:size-4"
        >
          {icon}
        </span>
      )}
      <span className="min-w-0">
        <span id={titleId} className="block text-base leading-tight font-bold text-ink-800">
          {step !== undefined && <span className="sr-only">Step {step}: </span>}
          {title}
        </span>
        {subtitle && <span className="mt-0.5 block text-xs text-ink-600">{subtitle}</span>}
      </span>
    </span>
  )

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'rounded-card border border-line/80 bg-mist-100/70 p-4 shadow-card lg:p-5 desk:p-4',
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3">
        {collapsible ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((o) => !o)}
            className="-m-1 flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg p-1"
          >
            {heading}
            <ChevronDown
              aria-hidden
              className={cn('size-5 shrink-0 text-ink-500 transition-transform', open && 'rotate-180')}
            />
          </button>
        ) : (
          <>
            {heading}
            {(badge || actions) && (
              <div className="flex shrink-0 items-center gap-2">
                {badge}
                {actions}
              </div>
            )}
          </>
        )}
        {collapsible && badge}
      </header>
      {expanded && (
        <div id={bodyId} className={cn('mt-4 flex flex-col gap-4 desk:mt-3 desk:gap-3', bodyClassName)}>
          {children}
        </div>
      )}
    </section>
  )
}
