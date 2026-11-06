import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface AuthHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  /** SAF: small teal uppercase line above the title ("YOUR CREATIVE SPACE"). */
  eyebrow?: ReactNode
  /** Both SAF mockups are left-aligned; `center` is kept for API parity with Moonlight. */
  align?: 'left' | 'center'
  /** Navy by default (both SAF mockups); `brand` renders the title in teal. */
  titleTone?: 'ink' | 'brand'
  /** Tighter header for longer forms (Register). */
  compact?: boolean
}

/**
 * Eyebrow, heading (the page's only <h1>) and subtitle. Unlike Moonlight, the logo is not here:
 * SAF shows it in the brand bar above the page.
 */
export function AuthHeader({
  title,
  subtitle,
  eyebrow,
  align = 'left',
  titleTone = 'ink',
  compact = false,
}: AuthHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col',
        'gap-(--auth-header-gap)',
        align === 'center' && 'items-center text-center',
      )}
    >
      {/* Decorative: dropped on ≤ 576px-tall screens (iPhone SE 1st gen) so the card fits. */}
      {eyebrow && (
        <p
          className={cn(
            'text-xs font-bold tracking-eyebrow text-brand-700 uppercase [@media(max-height:36rem)]:hidden',
            // Register's longer form: also on ≤ 640px-tall screens (small phones, touch laptops). Mouse
            // desktops ≥ 1024px keep it: their scaled root (index.css) leaves room for it.
            compact &&
              'not-pointer-fine:[@media(max-height:40rem)]:hidden max-lg:[@media(max-height:40rem)]:hidden',
          )}
        >
          {eyebrow}
        </p>
      )}
      <h1
        className={cn(
          'font-extrabold tracking-display text-balance',
          // Fluid (`--auth-title`, index.css). Also capped by the card width (AuthLayout makes it a
          // container) so "Create Your Account." / "Welcome Back." stay on one line on 320px phones.
          compact
            ? 'text-[min(9.5cqi,var(--auth-title,2.75rem))]'
            : 'text-[min(12cqi,var(--auth-title,3.25rem))]',
          // Must come AFTER the font-size classes: tailwind-merge drops a `leading-*` that
          // precedes a font-size utility (font-size resets line-height).
          'leading-[1.05]',
          titleTone === 'brand' && 'text-brand-700',
        )}
      >
        {title}
      </h1>
      {subtitle && (
        <p className="text-[length:var(--auth-subtitle,1.125rem)] leading-snug text-pretty text-ink-600">
          {subtitle}
        </p>
      )}
    </header>
  )
}
