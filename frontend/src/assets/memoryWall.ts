import headerBackgroundSrc from './images/memory-wall/header-background.png?w=2172&quality=80&format=webp'
import layoutBalancedGridSrc from './images/memory-wall/layouts/balanced-grid.webp'
import layoutCentreFocusSrc from './images/memory-wall/layouts/centre-focus.webp'
import layoutCreativeSalonSrc from './images/memory-wall/layouts/creative-salon.webp'
import layoutMinimalRowSrc from './images/memory-wall/layouts/minimal-row.webp'
import roomBackgroundSrc from './images/memory-wall/memory-wall.png?w=1860&quality=80&format=webp'
import roomBackgroundSrcSet from './images/memory-wall/memory-wall.png?w=640;960;1280;1860&format=webp&quality=80&as=srcset'
import type { SamplePhotoAsset } from './types'

const SAMPLE_PHOTO_GLOB = import.meta.glob<string>('./images/memory-wall/frames/*.png', {
  eager: true,
  import: 'default',
  // PNG sources are 2–3.4 MB each; this re-encodes every sample to ≤640px WebP.
  query: '?w=320;640&format=webp&quality=78&as=srcset',
})
const SAMPLE_PHOTO_SRC_GLOB = import.meta.glob<string>('./images/memory-wall/frames/*.png', {
  eager: true,
  import: 'default',
  query: '?w=640&format=webp&quality=78',
})

/**
 * Ids stay `frame-NN` (Moonlight's scheme): planner state and saved designs reference samples by
 * id. All 15 delivered samples are portrait (1122×1402); `sampleFor` falls back to them for
 * landscape frames.
 */
const SAMPLE_PHOTO_ALTS = [
  'Laughing girl at a sunset picnic',
  'Mountain trail through wildflowers at sunrise',
  'Eucalyptus sprig on a cream background',
  'Couple cooking together in a rustic kitchen',
  'Sea cliffs with pink flowers above turquoise water',
  'Pampas grass stem against a sage wall',
  'Grandparents reading a book with their granddaughter by the fire',
  'Flower-lined cobbled street at dusk',
  'Monstera leaf with water droplets',
  'Family laughing at a summer picnic',
  'Hot-air balloon over misty green hills',
  'Woman relaxing with a cup of tea by the window',
  'Bouquet of wildflowers wrapped in linen',
  'Wooden jetty on a mountain lake at sunset',
  'Sunbeams through a misty forest',
] as const

const SAMPLE_PHOTO_META: ReadonlyArray<Omit<SamplePhotoAsset, 'src' | 'srcSet'> & { file: string }> =
  SAMPLE_PHOTO_ALTS.map((alt, i) => {
    const n = String(i + 1).padStart(2, '0')
    return { id: `frame-${n}`, file: `${n}.png`, width: 1122, height: 1402, orientation: 'portrait', alt }
  })

/** Bundled sample photos for "Fill empty frames with samples" and demo layouts. */
export const samplePhotos: readonly SamplePhotoAsset[] = SAMPLE_PHOTO_META.map(({ file, ...meta }) => {
  const key = `./images/memory-wall/frames/${file}`
  const src = SAMPLE_PHOTO_SRC_GLOB[key]
  const srcSet = SAMPLE_PHOTO_GLOB[key]
  if (!src || !srcSet) throw new Error(`Sample photo missing from assets: ${file}`)
  return { ...meta, src, srcSet }
})

export const memoryWallAssets = {
  /**
   * Empty sunlit room (1860×846, ~2.2:1): window + plant left, arches + wood slats right, NO sofa.
   * The reference sofa isn't delivered yet (ASSETS.md A9); scale constants are set in Phase 4.
   */
  roomBackground: {
    src: roomBackgroundSrc,
    srcSet: roomBackgroundSrcSet,
    width: 1860,
    height: 846,
    alt: '',
  },
  /** Soft sunlit strip with plants at both ends, behind the planner hero (2172×197, alpha). */
  headerBackground: { src: headerBackgroundSrc, width: 2172, height: 197, alt: '' },
  /** "Need a little inspiration?" preset thumbnails (~750×423 room photos). */
  layoutThumbnails: {
    balancedGrid: {
      src: layoutBalancedGridSrc,
      width: 750,
      height: 423,
      alt: 'Balanced grid layout preview',
    },
    creativeSalon: {
      src: layoutCreativeSalonSrc,
      width: 748,
      height: 423,
      alt: 'Creative salon layout preview',
    },
    centreFocus: { src: layoutCentreFocusSrc, width: 750, height: 422, alt: 'Centre focus layout preview' },
    minimalRow: { src: layoutMinimalRowSrc, width: 748, height: 422, alt: 'Minimal row layout preview' },
  },
} as const
