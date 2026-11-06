import type { ReactNode } from 'react'
import type { AuthBackdropAsset } from '@/assets/types'
import { BrandBar } from '@/components/brand/BrandBar'
import { MEDIA } from '@/config/media'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/cn'
import { useBackdropFits } from '../hooks/useBackdropFits'
import { backdropStyle } from '../lib/backdropLayout'
import { AuthDecorations, type AuthVariant } from './AuthDecorations'
import { AuthHero } from './AuthHero'
import { AuthTagline } from './AuthTagline'

interface AuthLayoutProps {
  /** Full-page backdrop with baked-in art and copy (SAF). */
  hero: AuthBackdropAsset
  variant: AuthVariant
  /** Longer form (Register): the image-free card is a little wider. */
  compact?: boolean
  children: ReactNode
}

/**
 * Shared shell for Login / Register / Forgot password (docs/RESPONSIVE.md). `data-auth` scopes the
 * fluid `--auth-*` size tokens (index.css): every font, field, button and gap scales with the viewport.
 * - default (phones, tablets, near-square windows): brand bar, a floating white card on the mist
 *   page with soft arcs (the image isn't downloaded). Phones show only the card, centred, so it fits
 *   the viewport without scrolling; from `md` the tagline follows as live text below it;
 * - backdrop mode (`hero-fits` AND the card fits beside the art): the photographic backdrop fills
 *   the page and the card sits in its empty side, positioned by `backdropStyle` so it never covers
 *   the art or the baked-in text. `data-backdrop` on <main> drives the `on-backdrop:` CSS variant,
 *   so CSS and the JS decision can never disagree.
 */
export function AuthLayout({ hero, variant, compact = false, children }: AuthLayoutProps) {
  const heroFits = useMediaQuery(MEDIA.heroFits)
  const showHero = useBackdropFits(hero, heroFits)

  return (
    // overflow-x: clip guarantees no horizontal scrollbar from decorative layers (arcs, blurred
    // ambient image) at any zoom/scrollbar combination. Unlike `hidden`, `clip` doesn't create a
    // scroll container, so the sticky brand bar and sticky backdrop keep working.
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-mist-50">
      <BrandBar />

      <main
        data-auth=""
        data-backdrop={showHero ? '' : undefined}
        data-compact={compact ? '' : undefined}
        className="@container relative isolate flex flex-1 flex-col"
        style={backdropStyle(hero)}
      >
        {showHero ? <AuthHero image={hero} /> : <AuthDecorations variant={variant} />}

        <div
          className={cn(
            // Phones: the card alone, centred in the space under the bar. md+: card, then tagline.
            'flex flex-1 flex-col items-center justify-center px-4 py-(--auth-zone-py) sm:px-6',
            // Register (5 fields) stays centred with fluid padding everywhere, so it never scrolls.
            !compact && 'md:justify-start md:pt-20 md:pb-12',
            'on-backdrop:min-h-(--hero-h) on-backdrop:flex-none on-backdrop:items-start on-backdrop:justify-center on-backdrop:px-0 on-backdrop:py-(--auth-zone-py)',
          )}
        >
          {/* A size container: the compact title scales with the card's width (AuthHeader). */}
          <div
            className={cn(
              '@container w-full rounded-card border border-line/80 bg-surface shadow-float',
              'px-(--auth-card-px) py-(--auth-card-py)',
              compact ? 'max-w-[32rem]' : 'max-w-[30rem] md:max-w-[32rem]',
              // Laptops cap the card (`--auth-card-max`, 26rem) and keep it centred in its zone.
              'on-backdrop:ml-[calc(var(--card-x)+(var(--card-w)-min(var(--card-w),var(--auth-card-max)))/2)]',
              'on-backdrop:w-[min(var(--card-w),var(--auth-card-max))] on-backdrop:max-w-none',
            )}
          >
            {children}
          </div>

          {/* Not on phones (portrait or landscape): there the card alone fills the viewport. */}
          {!showHero && (
            <AuthTagline
              tagline={hero.tagline}
              className={
                compact
                  ? // Register: only on tall image-free screens (≥ 1088px, e.g. 1024×1366), where the
                    // card + tagline + steps fit without scrolling.
                    'hidden [@media(min-width:48rem)_and_(min-height:68rem)]:flex'
                  : 'hidden md:flex [@media(max-height:40rem)]:hidden'
              }
            />
          )}
        </div>
      </main>
    </div>
  )
}
