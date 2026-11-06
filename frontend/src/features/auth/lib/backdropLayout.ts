import type { CSSProperties } from 'react'
import type { AuthBackdropAsset } from '@/assets/types'

/**
 * SAF-only presentation maths (no Moonlight counterpart). Turns a backdrop's measured fractions
 * into CSS custom properties that position the auth card beside the baked-in art, at any viewport.
 *
 * Model (all live CSS, so it tracks resizes without JS):
 * - The backdrop fills the region under the brand bar: height H = 100dvh − bar.
 * - Its box is at most `maxAspect` × H wide (asset override, default BACKDROP_MAX_ASPECT; wider would
 *   crop the baked text top and bottom) and centred; on ultra-wide screens its edges fade into the page.
 * - `fits` (resolveBackdrop) says whether a minimum-width card can clear the art at all; when it can't,
 *   AuthLayout uses the image-free layout instead (useBackdropFits).
 * - Inside the box the image is `object-cover`, anchored to the ART side, so it renders
 *   `iw = max(box, ratio × H)` wide and only the empty card side is ever cropped.
 * - The card zone runs from the far edge (gutter, or the baked captions' edge) to the art edge
 *   minus a gap. The card is ~36% of the image width (as in the mockup), clamped to 22–34rem, and
 *   centred in the zone. If the zone is narrower than the minimum card, the card stays clear of
 *   the art and may cover the (decorative) captions instead.
 *
 * Container units (cqw) measure the layout width without the scrollbar; `<main>` is the container.
 */
export const BACKDROP_MAX_ASPECT = 1.9
/** Card width as a fraction of the rendered image width (570 / 1585 in the login mockup). */
const CARD_SHARE = 0.36
const GAP_TO_ART = '2rem'
const GUTTER = '1.5rem'

const n = (v: number) => Number(v.toFixed(4))

export type BackdropGeometry = Pick<
  AuthBackdropAsset,
  'width' | 'height' | 'cardSide' | 'artEdge' | 'captionEdge' | 'maxAspect' | 'edgeFade'
> &
  Partial<Pick<AuthBackdropAsset, 'objectPosition'>>

/**
 * Vertical anchor (0–1) of a CSS `object-position` such as `'100% 50%'`. The manifests use
 * percentages (or top / center / bottom); anything else falls back to the centre.
 */
export function objectPositionY(position: string | undefined): number {
  const y = position?.trim().split(/\s+/)[1] ?? '50%'
  if (y === 'top') return 0
  if (y === 'bottom') return 1
  if (y === 'center') return 0.5
  const m = /^(-?\d+(?:\.\d+)?)%$/.exec(y)
  return m ? Math.min(1, Math.max(0, Number(m[1]) / 100)) : 0.5
}

const DEFAULT_EDGE_FADE = { card: 0.03, art: 0.01 } as const

/** Used when an asset's intrinsic size is missing or invalid (the mockup canvas ratio). */
const FALLBACK_RATIO = 1585 / 992

/**
 * Manifest values are hand-measured: never let a typo (0 / NaN size, fraction outside 0–1,
 * captions past the art) turn into NaN/Infinity in CSS, which would silently drop the card's
 * position and let it cover the art.
 */
function normalize(asset: BackdropGeometry) {
  const ratio = asset.width > 0 && asset.height > 0 ? asset.width / asset.height : Number.NaN
  const unit = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0)
  const left = asset.cardSide === 'left'
  // Default art edge: the middle (the card gets the empty half).
  const e = Number.isFinite(asset.artEdge) ? unit(asset.artEdge) : 0.5
  const rawC = unit(asset.captionEdge)
  // Captions must sit between the outer edge and the art, on the card's side; otherwise ignore them.
  const c = rawC > 0 && (left ? rawC < e : rawC > e) ? rawC : 0
  // A box narrower than 1:1 or wider than 3:1 is never sensible; fall back to the default.
  const maxAspect =
    asset.maxAspect !== undefined &&
    Number.isFinite(asset.maxAspect) &&
    asset.maxAspect >= 1 &&
    asset.maxAspect <= 3
      ? asset.maxAspect
      : BACKDROP_MAX_ASPECT
  // Edge-fade limits: fractions of the image width, at most a quarter of it.
  const fade = (v: number | undefined, fallback: number) =>
    v !== undefined && Number.isFinite(v) ? Math.min(0.25, Math.max(0, v)) : fallback
  const edgeFade = {
    card: fade(asset.edgeFade?.card, DEFAULT_EDGE_FADE.card),
    art: fade(asset.edgeFade?.art, DEFAULT_EDGE_FADE.art),
  }
  return { ratio: Number.isFinite(ratio) ? ratio : FALLBACK_RATIO, e, c, left, maxAspect, edgeFade }
}

export function backdropStyle(asset: BackdropGeometry): CSSProperties {
  const g = normalize(asset)
  const ratio = n(g.ratio)
  const e = n(g.e)
  const c = n(g.c)
  const left = g.left

  // Box coordinates (0 = box's left edge). Left card → image anchored right: its left edge is bw − iw.
  const artInBox = left ? `calc(var(--bw) - ${n(1 - e)} * var(--iw))` : `calc(${e} * var(--iw))`
  const capInBox =
    c > 0 ? (left ? `calc(var(--bw) - ${n(1 - c)} * var(--iw))` : `calc(${c} * var(--iw))`) : '0px'

  // Screen coordinates (0 = container's left edge).
  const zoneStart = left
    ? c > 0
      ? `max(${GUTTER}, calc(var(--box-x) + var(--cap-in-box) + ${GUTTER}))`
      : GUTTER
    : `calc(var(--art) + ${GAP_TO_ART})`
  const zoneEnd = left
    ? `calc(var(--art) - ${GAP_TO_ART})`
    : c > 0
      ? // The image may extend past the viewport (cropped empty side): never past the gutter.
        `min(calc(var(--box-x) + var(--cap-in-box) - ${GUTTER}), calc(100cqw - ${GUTTER}))`
      : `calc(100cqw - ${GUTTER})`
  const centred = 'calc(var(--zone-start) + (var(--zone-end) - var(--zone-start) - var(--card-w)) / 2)'
  // Centred in the zone. If the zone is too narrow, the card stays clear of the ART (it may cover
  // the decorative captions/edge instead): left card → flush with zone-end; right → with zone-start.
  const cardX = left
    ? `max(1rem, min(${centred}, calc(var(--zone-end) - var(--card-w))))`
    : `min(calc(100cqw - 1rem - var(--card-w)), max(${centred}, var(--zone-start)))`

  return {
    '--hero-h': 'calc(100dvh - var(--bar-h))',
    '--bw': `min(100cqw, ${n(g.maxAspect)} * var(--hero-h))`,
    '--box-x': 'calc((100cqw - var(--bw)) / 2)',
    '--iw': `max(var(--bw), ${ratio} * var(--hero-h))`,
    // Rendered image height and top offset (object-cover + object-position in a hero-h tall box).
    // AuthHero's edge fill uses them so its colour bands line up row-for-row with the image.
    '--ih': `calc(var(--iw) / ${ratio})`,
    '--img-top': `calc((var(--hero-h) - var(--ih)) * ${n(objectPositionY(asset.objectPosition))})`,
    '--cap-in-box': capInBox,
    '--art': `calc(var(--box-x) + ${artInBox})`,
    '--zone-start': zoneStart,
    '--zone-end': zoneEnd,
    '--card-w': `clamp(22rem, min(${CARD_SHARE} * var(--iw), var(--zone-end) - var(--zone-start)), 34rem)`,
    '--card-x': cardX,
    // Box-edge fades into the ambient fill (index.css `backdrop-fade-*`). They grow with the side
    // margin (`--box-x`) so wide windows blend gradually, but never past the asset's safe edge
    // (baked text) or 10rem / 6rem. With no margin they're the original 3rem / 0.75rem (or less).
    '--fade-card': `min(max(3rem, var(--box-x)), ${n(g.edgeFade.card)} * var(--bw), 10rem)`,
    '--fade-art': `min(max(0.75rem, var(--box-x)), ${n(g.edgeFade.art)} * var(--bw), 6rem)`,
  } as CSSProperties
}

export interface BackdropViewport {
  width: number
  height: number
  /** Brand bar height in px (`--bar-h`). */
  barPx: number
  /**
   * Root font size in px, i.e. what 1rem resolves to in the CSS (default 16). Mouse desktops scale it
   * on auth pages (index.css `--auth-root`), and the rem lengths in backdropStyle scale with it.
   */
  rootPx?: number
}

/**
 * The same model evaluated in px: where the art edge and the card land for a viewport, and whether
 * the minimum-width card `fits` beside the art without touching it. AuthLayout uses `fits` to fall
 * back to the image-free layout (e.g. Register at 4:3, whose empty side is narrower than Login's).
 */
export function resolveBackdrop(asset: BackdropGeometry, viewport: BackdropViewport) {
  const rem = viewport.rootPx !== undefined && viewport.rootPx > 0 ? viewport.rootPx : 16
  const { ratio, e, c, left, maxAspect } = normalize(asset)
  const W = Math.max(0, viewport.width)
  // CSS can't produce a negative region either: the hero area is at least 0 tall.
  const H = Math.max(0, viewport.height - viewport.barPx)
  const bw = Math.min(W, maxAspect * H)
  const boxX = (W - bw) / 2
  const iw = Math.max(bw, ratio * H)
  const art = boxX + (left ? bw - (1 - e) * iw : e * iw)
  const cap = c > 0 ? boxX + (left ? bw - (1 - c) * iw : c * iw) : 0
  const zoneStart = left ? (c > 0 ? Math.max(1.5 * rem, cap + 1.5 * rem) : 1.5 * rem) : art + 2 * rem
  const zoneEnd = left ? art - 2 * rem : c > 0 ? Math.min(cap - 1.5 * rem, W - 1.5 * rem) : W - 1.5 * rem
  const cardW = Math.min(34 * rem, Math.max(22 * rem, Math.min(CARD_SHARE * iw, zoneEnd - zoneStart)))
  const centred = zoneStart + (zoneEnd - zoneStart - cardW) / 2
  const cardX = left
    ? Math.max(rem, Math.min(centred, zoneEnd - cardW))
    : Math.min(W - rem - cardW, Math.max(centred, zoneStart))
  const cardEnd = cardX + cardW
  // Half-pixel tolerance for rounding; the 2rem art gap is already inside the zone.
  const fits = left
    ? cardX >= 0 && cardEnd <= art - 2 * rem + 0.5
    : cardX >= art + 2 * rem - 0.5 && cardEnd <= W
  return { art, zoneStart, zoneEnd, cardX, cardW, cardEnd, imageWidth: iw, boxWidth: bw, boxX, fits }
}

/** True when the backdrop layout can show the card beside the art at this viewport. */
export const backdropFits = (asset: BackdropGeometry, viewport: BackdropViewport) =>
  resolveBackdrop(asset, viewport).fits
