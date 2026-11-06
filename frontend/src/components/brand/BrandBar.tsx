import type { ReactNode } from 'react'
import { APP_NAME } from '@/config/app'
import { cn } from '@/lib/cn'
import { Logo } from './Logo'

interface BrandBarProps {
  /** Right-hand slot, e.g. the planner's profile menu. */
  actions?: ReactNode
  className?: string
}

/**
 * SAF-only: the white top bar from every mockup. Monogram · hairline · live-text wordmark, which
 * recreates the mockup's horizontal lockup from the (stacked) delivered logo. Height comes from
 * `--bar-h` (index.css) so layouts below can size themselves to the remaining viewport.
 */
export function BrandBar({ actions, className }: BrandBarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 h-(--bar-h) shrink-0 border-b border-line bg-surface/90 backdrop-blur-md',
        className,
      )}
    >
      {/* Full-bleed on every page (no centred cap): wide windows get no blank edges (audit). */}
      <div className="flex h-full items-center gap-3 px-4 sm:px-6 lg:px-12">
        {/*
          Narrow phones with an `actions` slot (planner profile menu) have ~150px for the wordmark,
          so mark, gap and tracking step down below 400px; the tagline line appears from 440px.
          The full name never truncates from 320px up (audit).
        */}
        <div className="flex min-w-0 items-center gap-2 min-[400px]:gap-3 sm:gap-4">
          <Logo variant="mark" alt="" className="h-6 w-auto min-[400px]:h-7 sm:h-9 lg:h-10" />
          <span aria-hidden className="h-6 w-px shrink-0 bg-line min-[400px]:h-7 sm:h-9" />
          <p className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-[0.6875rem] leading-none font-medium tracking-[0.06em] text-ink-900 uppercase min-[400px]:text-[0.8125rem] min-[400px]:tracking-[0.14em] sm:text-base lg:text-lg">
              {APP_NAME}
            </span>
            <span className="hidden truncate text-[0.5625rem] leading-none font-medium tracking-caption text-ink-500 uppercase min-[440px]:block sm:text-[0.625rem]">
              Custom art. Timeless frames.
            </span>
          </p>
        </div>
        {actions && <div className="ml-auto flex shrink-0 items-center">{actions}</div>}
      </div>
    </header>
  )
}
