import loginBackdropSrc from './images/login/login.png?w=1585&quality=80&format=webp'
import loginBackdropSrcSet from './images/login/login.png?w=960;1280;1585&format=webp&quality=80&as=srcset'
import registerBackdropSrc from './images/register/register.png?w=1672&quality=80&format=webp'
import registerBackdropSrcSet from './images/register/register.png?w=960;1280;1672&format=webp&quality=80&as=srcset'
import type { AuthBackdropAsset } from './types'

/**
 * Full-page auth backdrops. Art, tagline and side captions are BAKED INTO the images, so:
 * - never overlay the same text in HTML where the image is visible (it's in `alt` instead);
 * - render only under the `hero-fits` variant, positioned by AuthLayout's backdrop geometry so
 *   the card never covers the art and the text is never cropped (docs/RESPONSIVE.md).
 * Fractions were measured on the source files.
 */
export const authAssets = {
  login: {
    backdrop: {
      src: loginBackdropSrc,
      srcSet: loginBackdropSrcSet,
      width: 1585,
      height: 992,
      objectPosition: '100% 50%',
      cardSide: 'left',
      // Gallery art + guide lines start at x≈830; left captions ("ART / FRAMES…") end at x≈182.
      artEdge: 830 / 1585,
      captionEdge: 182 / 1585,
      // Baked captions come within ~2.8% (left "ART / FRAMES…") and ~1.6% (right "MOMENTS INTO")
      // of the edges, so wide-window fades stop just short of them.
      edgeFade: { card: 0.025, art: 0.012 },
      // Measured: outermost 24px column, 16 bands (see AuthBackdropAsset.edgeFill).
      edgeFill: {
        left: [
          '#e9f2f4',
          '#e9f2f4',
          '#ebf3f5',
          '#f8fafb',
          '#f1f4f5',
          '#f9fafb',
          '#f9fbfb',
          '#f8fafa',
          '#f2f4f3',
          '#9ba087',
          '#83876b',
          '#4e4b20',
          '#938970',
          '#c9c1b9',
          '#a1988f',
          '#a19e9a',
        ],
        right: [
          '#f9f8f8',
          '#f9f9f9',
          '#faf9f9',
          '#f9f9f9',
          '#f9f9f9',
          '#f4f3f2',
          '#ecebe9',
          '#edecea',
          '#ecebe9',
          '#edeceb',
          '#f0f0ef',
          '#f3f3f2',
          '#f4f3f3',
          '#f4f4f3',
          '#f5f4f5',
          '#ebeaea',
        ],
      },
      alt: 'A sunlit wall with a gallery of framed botanical, abstract, architectural and landscape art. Your space. Your art. Your story. Thoughtfully designed frames for memories worth keeping.',
      tagline: {
        title: 'Your space. Your art. Your story.',
        subtitle: 'Thoughtfully designed frames for memories worth keeping.',
      },
    } satisfies AuthBackdropAsset,
  },
  register: {
    backdrop: {
      src: registerBackdropSrc,
      srcSet: registerBackdropSrcSet,
      width: 1672,
      height: 941,
      // Measured (Phase 3): framed art starts at y≈4.5% and the baked steps' glyphs end ~2.5% above the
      // bottom edge, too close for the default 1.9:1 cap (1920×1080 clipped them). Capping the box at
      // 1.8:1 limits vertical crop to ~1.3%; 60% splits that crop between top and bottom.
      objectPosition: '0% 60%',
      maxAspect: 1.8,
      cardSide: 'right',
      // Frames, vase and plant twigs end at x≈972–990; the window and plants start at x≈1570
      // (treated like captions: the card avoids them when there's room, may cover them when not).
      artEdge: 990 / 1672,
      captionEdge: 1570 / 1672,
      // Edges are décor only (window plants right, wood slats left; the tagline starts at x≈10%), so
      // wide-window fades can be generous.
      edgeFade: { card: 0.06, art: 0.08 },
      edgeFill: {
        left: [
          '#c9a27c',
          '#c9a37f',
          '#d3ad89',
          '#d0ac88',
          '#d4b18d',
          '#e1bf9f',
          '#d5b892',
          '#848053',
          '#606032',
          '#82744d',
          '#bca995',
          '#cec6bf',
          '#d0c9c1',
          '#cbc3ba',
          '#9ea585',
          '#7d7d5b',
        ],
        right: [
          '#d7e1d7',
          '#e1eeec',
          '#e5f2f5',
          '#e8f4f8',
          '#eaeddf',
          '#e1e7dc',
          '#e1e1c9',
          '#888d5a',
          '#8f9060',
          '#e1e1c5',
          '#dfdfc8',
          '#a7a789',
          '#737a4d',
          '#737852',
          '#707751',
          '#81876d',
        ],
      },
      alt: 'A bright gallery room with framed landscapes, botanical prints and a family photo above a shelf of frame samples. Every wall begins with a story. Bring your memories, art and imagination together in one beautiful space. 01 Personalise, 02 Visualise, 03 Create.',
      tagline: {
        title: 'Every wall begins with a story.',
        subtitle: 'Bring your memories, art and imagination together in one beautiful space.',
        steps: ['Personalise', 'Visualise', 'Create'],
      },
    } satisfies AuthBackdropAsset,
  },
} as const
