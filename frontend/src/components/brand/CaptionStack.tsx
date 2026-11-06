import { cn } from '@/lib/cn'

interface CaptionStackProps {
  items: readonly string[]
  /** Optional "/ 01" index above the list. */
  index?: string
  className?: string
}

/**
 * SAF-only: the gallery-label caption stacks from the mockup edges ("ART / FRAMES / PRINTS…"),
 * a hairline on the left and tracked uppercase lines. Decorative: hidden from assistive tech.
 */
export function CaptionStack({ items, index, className }: CaptionStackProps) {
  return (
    <div aria-hidden className={cn('flex gap-4 select-none', className)}>
      <span className="w-px shrink-0 bg-ink-500/40" />
      <div className="flex flex-col gap-2.5 py-1 text-[0.6875rem] leading-none font-semibold tracking-caption text-ink-600 uppercase">
        {index && (
          <span className="mb-1 text-ink-800">
            <span className="font-normal text-ink-300">/ </span>
            {index}
          </span>
        )}
        {items.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </div>
  )
}
