/**
 * Asset manifests: one module per area so each page bundles only the assets it uses.
 *   @/assets/brand       → logo, shared icons
 *   @/assets/auth        → login / register heroes and ornaments
 *   @/assets/memoryWall  → planner backdrop, sample photos, layout thumbnails
 * These modules are the ONLY importers of image files. Components never import raw paths.
 * Inventory, quality notes and workarounds: docs/ASSETS.md.
 */

export interface ImageAsset {
  /** Fallback / default URL. */
  src: string
  /** Responsive candidates for `srcSet` (raster only). */
  srcSet?: string
  /** Intrinsic size. Always pass to <img> to prevent layout shift. */
  width: number
  height: number
  /** Default alt text. Use `''` for purely decorative images. */
  alt: string
}

/** A photo with text baked in: `objectPosition` is the crop anchor that keeps the text in view. */
export interface HeroImageAsset extends ImageAsset {
  objectPosition: string
}

export type Orientation = 'portrait' | 'landscape'

export interface SamplePhotoAsset extends ImageAsset {
  id: string
  orientation: Orientation
}

/**
 * SAF-only: a full-page auth backdrop (login.png / register.png) with the art, tagline and side
 * captions baked in. The card sits over the image's empty side. The fractions let AuthLayout keep
 * the card clear of the art at every aspect ratio (docs/RESPONSIVE.md, "Backdrop geometry").
 */
export interface AuthBackdropAsset extends HeroImageAsset {
  /** Which side of the image is empty and holds the form card. */
  cardSide: 'left' | 'right'
  /** x of the art's edge nearest the card, as a fraction of the image width. */
  artEdge: number
  /** x of the far edge of baked-in captions on the card's side (fraction), or 0 if there are none. */
  captionEdge: number
  /**
   * Widest box (width ÷ height) before the image is letterboxed instead of cropped top/bottom.
   * Default 1.9. Lower it when baked text sits close to the top/bottom edge.
   */
  maxAspect?: number
  /**
   * How much of each image edge may be faded into the ambient fill on wide windows, as a fraction of
   * the image width: stop before any baked text. `card` = the card-side edge, `art` = the opposite.
   * Default { card: 0.03, art: 0.01 }.
   */
  edgeFade?: { card: number; art: number }
  /**
   * Average colours of the image's outermost 24px column, top → bottom in equal bands (measured
   * with sharp). On windows wider than `maxAspect` they continue the image beyond its edges (wall,
   * floor, light) as vertical gradients, fading into the page colour, so there's no seam or blur.
   */
  edgeFill?: { left: readonly string[]; right: readonly string[] }
  /**
   * The baked-in tagline (and Register's numbered steps). Rendered as live text only where the
   * image is NOT shown (phones/tablets), never alongside it.
   */
  tagline: { title: string; subtitle: string; steps?: readonly string[] }
}
