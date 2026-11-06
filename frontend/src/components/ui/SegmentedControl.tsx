import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
  /** Accessible name when `label` is not plain text. */
  ariaLabel?: string
}

interface SegmentedControlProps<T extends string> {
  /** Group label (visually hidden unless `showLabel`). */
  label: string
  showLabel?: boolean
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  /**
   * `track` (default): joined pill track ("ft | in | cm | m").
   * `tiles` (SAF): separate cards with the icon above the label (planner "Layout Selection").
   */
  variant?: 'track' | 'tiles'
  disabled?: boolean
  className?: string
}

/**
 * Mutually exclusive options ("ft | in | cm | m", "Grid | Salon | Centre | Row").
 * Built on native radio inputs: arrow keys, focus and form semantics come for free.
 */
export function SegmentedControl<T extends string>({
  label,
  showLabel = false,
  options,
  value,
  onChange,
  size = 'md',
  variant = 'track',
  disabled = false,
  className,
}: SegmentedControlProps<T>) {
  const name = useId()
  const tiles = variant === 'tiles'
  return (
    <fieldset disabled={disabled} className={cn('min-w-0', className)}>
      <legend className={cn(showLabel ? 'mb-2 text-sm font-semibold text-ink-800' : 'sr-only')}>
        {label}
      </legend>
      <div
        className={cn(
          'grid',
          tiles ? 'gap-2' : 'gap-0.5 rounded-field border border-line bg-surface p-0.5 shadow-field',
        )}
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((opt) => (
          <label key={opt.value} className="relative min-w-0">
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={opt.value === value}
              onChange={() => onChange(opt.value)}
              aria-label={opt.ariaLabel}
              className="peer sr-only"
            />
            <span
              className={cn(
                'flex w-full cursor-pointer items-center justify-center font-medium transition-colors select-none',
                'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600',
                'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
                tiles
                  ? cn(
                      'flex-col gap-1.5 rounded-field border border-line bg-surface px-1 pt-2.5 pb-2 text-xs text-ink-700 shadow-field sm:text-sm',
                      'hover:border-ink-300 [&>svg]:h-7 [&>svg]:w-auto [&>svg]:max-w-full',
                      'peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:text-brand-800 peer-checked:ring-1 peer-checked:ring-brand-600',
                    )
                  : cn(
                      'gap-1 truncate rounded-md text-sm text-ink-700 hover:bg-mist-100 [&>svg]:size-3.5 [&>svg]:shrink-0',
                      size === 'sm' ? 'h-8 px-1.5' : 'h-9 px-1.5',
                      'peer-checked:bg-brand-600 peer-checked:text-white peer-checked:shadow-button peer-checked:hover:bg-brand-600',
                    ),
              )}
            >
              {opt.icon}
              <span className="max-w-full truncate">{opt.label}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
