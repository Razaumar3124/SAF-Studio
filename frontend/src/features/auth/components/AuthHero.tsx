import type { CSSProperties } from 'react'
import type { AuthBackdropAsset } from '@/assets/types'
import { cn } from '@/lib/cn'

interface AuthHeroProps {
  image: AuthBackdropAsset
}

/**
 * Edge fill for windows wider than the box cap: each half of the region continues the image's own
 * outermost column (measured `edgeFill` stops) as a vertical gradient, sized and offset exactly like
 * the rendered image (`--ih` / `--img-top` from backdropStyle) so the bands meet the image row-for-row.
 * Pure CSS gradients: no second image decode, no blur, no seam.
 */
function edgeFillStyle(fill: AuthBackdropAsset['edgeFill']): CSSProperties | undefined {
  if (!fill || fill.left.length === 0 || fill.right.length === 0) return undefined
  const band = (stops: readonly string[]) =>
    stops.length === 1
      ? `linear-gradient(${stops[0]}, ${stops[0]})`
      : `linear-gradient(to bottom, ${stops.join(', ')})`
  return {
    backgroundImage: `${band(fill.left)}, ${band(fill.right)}`,
    backgroundSize: '50% var(--ih)',
    backgroundPosition: '0 var(--img-top), 100% var(--img-top)',
    backgroundRepeat: 'no-repeat',
  }
}

/**
 * Full-page photographic backdrop (SAF). The tagline and captions are baked into the image, so
 * the alt text carries them and nothing is overlaid. The parent mounts this only in backdrop mode,
 * so devices that don't show it never download it.
 *
 * Layers (sticky, so the art stays put if a long form scrolls):
 * 1. Edge fill (above): the wall / floor / light continue past the image's edges on wide windows,
 *    softened toward the page colour by side vignettes.
 * 2. The sharp image, in a box centred and capped at `maxAspect` × height (`--bw`) so baked text is
 *    never cropped (pure `cover` would cut it at wide aspects). Its edges fade (`backdrop-fade-*` in
 *    index.css) into the fill, and on ≈ 4:3 screens the cropped captions fade out completely.
 */
export function AuthHero({ image }: AuthHeroProps) {
  const left = image.cardSide === 'left'
  return (
    <div className="pointer-events-none absolute inset-0 -z-10">
      <div
        data-edge-fill={image.edgeFill ? '' : undefined}
        className="sticky top-(--bar-h) h-(--hero-h) overflow-hidden bg-mist-50"
        style={edgeFillStyle(image.edgeFill)}
      >
        {/* Side vignettes: only as wide as the margins (0 when the box spans the window). */}
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 w-(--box-x) bg-linear-to-l from-mist-50/0 via-mist-50/25 to-mist-50/80"
        />
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 w-(--box-x) bg-linear-to-r from-mist-50/0 via-mist-50/25 to-mist-50/80"
        />
        <div
          className={cn(
            'absolute inset-y-0 left-(--box-x) w-(--bw)',
            left ? 'backdrop-fade-left' : 'backdrop-fade-right',
          )}
        >
          <img
            src={image.src}
            srcSet={image.srcSet}
            sizes="100vw"
            width={image.width}
            height={image.height}
            alt={image.alt}
            fetchPriority="high"
            decoding="async"
            draggable={false}
            className="size-full object-cover select-none"
            style={{ objectPosition: image.objectPosition }}
          />
        </div>
      </div>
    </div>
  )
}
