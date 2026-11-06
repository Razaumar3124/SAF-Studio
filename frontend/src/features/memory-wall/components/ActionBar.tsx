import { ArrowRight, Bookmark, LayoutGrid, Maximize2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

interface ActionBarProps {
  onFullscreen: () => void
  onTemplates: () => void
  onSaved: () => void
  onQuote: () => void
}

const ITEMS = (p: ActionBarProps) =>
  [
    {
      icon: <Maximize2 />,
      title: 'Preview Fullscreen',
      short: 'Preview',
      subtitle: 'View large & download',
      onClick: p.onFullscreen,
    },
    {
      icon: <LayoutGrid />,
      title: 'All Templates',
      short: 'Templates',
      subtitle: 'Explore layout templates',
      onClick: p.onTemplates,
    },
    {
      icon: <Bookmark />,
      title: 'My Saved Templates',
      short: 'Saved',
      subtitle: 'View your designs',
      onClick: p.onSaved,
    },
  ] as const

/**
 * Bottom actions (Moonlight's set: Download lives in the fullscreen preview, PORTING_PARITY D8; no
 * price display, D7). Desktop/tablet: SAF's floating white bar; phones: a fixed bar with icon buttons
 * and the quote CTA.
 */
export function ActionBar(props: ActionBarProps) {
  const items = ITEMS(props)
  return (
    <>
      <nav
        aria-label="Design actions"
        className="hidden items-center gap-2 rounded-card border border-line/80 bg-surface p-2.5 shadow-float md:grid md:grid-cols-3 desk:mx-auto desk:w-full desk:max-w-[68rem] desk:grid-cols-[repeat(3,minmax(0,1fr))_minmax(14rem,1fr)]"
      >
        {items.map((it) => (
          <button
            key={it.title}
            type="button"
            onClick={it.onClick}
            className="group flex min-w-0 items-center gap-3 rounded-field px-3 py-2.5 text-left transition-colors hover:bg-mist-100"
          >
            <span
              aria-hidden
              className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-ink-700 transition-colors group-hover:border-brand-200 group-hover:text-brand-700 [&>svg]:size-5"
            >
              {it.icon}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink-800">{it.title}</span>
              <span className="block truncate text-xs text-ink-500">{it.subtitle}</span>
            </span>
          </button>
        ))}
        <QuoteButton onClick={props.onQuote} className="h-13 text-base md:col-span-3 desk:col-span-1" />
      </nav>

      {/* Phones */}
      <nav
        aria-label="Design actions"
        className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-1 border-t border-line bg-surface/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgb(11_29_51/0.08)] backdrop-blur md:hidden"
      >
        {items.map((it) => (
          <MobileAction key={it.title} icon={it.icon} label={it.short} onClick={it.onClick} />
        ))}
        <QuoteButton
          onClick={props.onQuote}
          className="ml-auto h-12 min-w-0 flex-1 px-2 text-sm min-[360px]:px-3 min-[360px]:text-base"
        />
      </nav>
    </>
  )
}

function MobileAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-12 shrink-0 flex-col items-center gap-0.5 rounded-field py-1 text-[0.5625rem] leading-tight font-medium text-ink-700 active:bg-mist-100 min-[360px]:w-16 min-[360px]:text-[0.625rem] [&>svg]:size-5 [&>svg]:text-brand-700"
    >
      {icon}
      <span className="w-full truncate text-center">{label}</span>
    </button>
  )
}

/**
 * "Request a Quote": the shared Button (primary-gradient, same as the auth CTAs) rather than a
 * forked look-alike (Phase 4 audit). Same label, handler and phone sizing as Moonlight's QuoteButton.
 */
function QuoteButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <Button
      variant="primary-gradient"
      onClick={onClick}
      rightIcon={<ArrowRight aria-hidden className="hidden size-5 shrink-0 min-[360px]:block md:block" />}
      className={cn('active:scale-[0.98]', className)}
    >
      Request a Quote
    </Button>
  )
}
