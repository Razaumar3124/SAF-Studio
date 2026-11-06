import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type BadgeTone = 'new' | 'neutral' | 'success' | 'warning' | 'brand'

const tones: Record<BadgeTone, string> = {
  new: 'bg-success-600 text-white',
  neutral: 'border border-mist-300 bg-mist-100 text-ink-700',
  success: 'border border-success-600/25 bg-success-50 text-success-600',
  warning: 'border border-gold-300 bg-gold-100 text-gold-600',
  brand: 'bg-brand-600 text-white',
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&>svg]:size-3.5',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
