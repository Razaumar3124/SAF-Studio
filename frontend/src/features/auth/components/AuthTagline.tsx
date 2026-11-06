import type { AuthBackdropAsset } from '@/assets/types'
import { cn } from '@/lib/cn'

interface AuthTaglineProps {
  tagline: AuthBackdropAsset['tagline']
  className?: string
}

/**
 * SAF-only: the backdrop's tagline (and Register's 01–03 steps) as live text, for layouts that
 * don't show the image. It's baked into the image in backdrop mode, so never render both.
 * Paired with a small mini-gallery motif drawn in brand tokens. Marketing copy, so paragraphs and
 * a list rather than headings (each page keeps a single <h1>).
 */
export function AuthTagline({ tagline, className }: AuthTaglineProps) {
  return (
    <div className={cn('mt-14 flex w-full max-w-[32rem] flex-col gap-6', className)}>
      <div className="flex items-end gap-5">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <span aria-hidden className="h-0.5 w-10 bg-gold-400" />
          <p className="text-2xl leading-tight font-extrabold tracking-display text-balance text-ink-900 sm:text-3xl">
            {tagline.title}
          </p>
          <p className="text-sm text-pretty text-ink-600 sm:text-base">{tagline.subtitle}</p>
        </div>
        <MiniGallery className="hidden w-24 shrink-0 min-[400px]:block sm:w-32" />
      </div>

      {tagline.steps && (
        <ol className="grid grid-cols-3 gap-3 sm:gap-6">
          {tagline.steps.map((step, i) => (
            <li key={step} className="flex min-w-0 flex-col gap-2">
              <span aria-hidden className="h-0.5 w-7 bg-brand-600" />
              <span className="text-xs leading-none font-semibold tracking-eyebrow text-ink-800">
                {String(i + 1).padStart(2, '0')}
              </span>
              {/* Tighter tracking on phones: "PERSONALISE" must fit a third of a 320px column. */}
              <span className="truncate text-[0.625rem] leading-none font-semibold tracking-[0.08em] text-ink-600 uppercase min-[400px]:text-[0.6875rem] min-[400px]:tracking-[0.14em] sm:text-xs sm:tracking-caption">
                {step}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** Decorative frame cluster echoing the backdrop art: gold, black and canvas frames on a mint block. */
function MiniGallery({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 112" aria-hidden className={className} fill="none">
      <rect x="58" y="16" width="56" height="64" rx="2" fill="var(--color-sage-200)" />
      <rect
        x="10"
        y="6"
        width="44"
        height="56"
        rx="1.5"
        fill="var(--color-surface)"
        stroke="var(--color-gold-400)"
        strokeWidth="3"
      />
      <path
        d="M22 50c6-14 10-24 10-34m0 18c-6-2-10-6-11-12m11 22c6-3 9-8 10-13"
        stroke="var(--color-brand-700)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect
        x="62"
        y="4"
        width="40"
        height="46"
        rx="1.5"
        fill="var(--color-surface)"
        stroke="var(--color-ink-900)"
        strokeWidth="3"
      />
      <circle cx="78" cy="26" r="8" fill="var(--color-gold-300)" />
      <rect x="82" y="22" width="12" height="20" fill="var(--color-brand-800)" />
      <rect
        x="6"
        y="68"
        width="40"
        height="40"
        rx="1.5"
        fill="var(--color-surface)"
        stroke="var(--color-ink-900)"
        strokeWidth="3"
      />
      <path d="M14 98l9-12 6 7 4-4 7 9z" fill="var(--color-mist-300)" />
      <rect x="54" y="58" width="58" height="44" rx="1.5" fill="var(--color-mist-200)" />
      <path d="M54 92l14-14 10 9 12-13 22 18v10H54z" fill="var(--color-brand-300)" opacity=".7" />
      <rect x="40" y="78" width="12" height="30" fill="var(--color-gold-300)" opacity=".7" />
    </svg>
  )
}
