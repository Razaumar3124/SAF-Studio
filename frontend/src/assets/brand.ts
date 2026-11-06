import googleGSrc from './icons/google-g.svg'
import logoMarkSrc from './images/logo-mark.svg'
import logoSrc from './images/logo.svg'
import type { ImageAsset } from './types'

export const brandAssets = {
  /** Stacked lockup: SAF monogram above the "SAGAR ARTS & FRAMES" wordmark. Vector, as delivered. */
  logo: { src: logoSrc, width: 890, height: 505, alt: 'Sagar Arts & Frames' },
  /**
   * Monogram only, derived from logo.svg by a viewBox crop (ASSETS.md). The brand bar pairs it with
   * a live-text wordmark to get the mockup's horizontal lockup.
   */
  logoMark: { src: logoMarkSrc, width: 880, height: 390, alt: 'SAF' },
} as const satisfies Record<string, ImageAsset>

export const iconAssets = {
  google: { src: googleGSrc, width: 48, height: 48, alt: '' },
} as const satisfies Record<string, ImageAsset>
