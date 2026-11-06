import { useSyncExternalStore } from 'react'
import { backdropFits, type BackdropGeometry, type BackdropViewport } from '../lib/backdropLayout'

const subscribe = (onChange: () => void) => {
  window.addEventListener('resize', onChange)
  return () => window.removeEventListener('resize', onChange)
}

/**
 * Current layout viewport, brand-bar height (`--bar-h` from index.css, rem or px) and the auth root
 * font size. `--auth-root` is a registered <length> (index.css), so it reads as resolved px even on the
 * first render, before <main data-auth> exists and the root font actually changes.
 */
function readViewport(): BackdropViewport {
  const root = document.documentElement
  const style = getComputedStyle(root)
  const rootPx =
    Number.parseFloat(style.getPropertyValue('--auth-root')) || Number.parseFloat(style.fontSize) || 16
  const bar = style.getPropertyValue('--bar-h').trim()
  const barValue = Number.parseFloat(bar) || 0
  return {
    width: root.clientWidth,
    height: window.innerHeight,
    barPx: bar.endsWith('rem') ? barValue * rootPx : barValue,
    rootPx,
  }
}

/**
 * SAF-only. Whether the photographic backdrop can be shown with the card beside the art (not on
 * it) at the current viewport. Only evaluated when `enabled` (the `hero-fits` media query), so
 * phones and tablets never measure. Re-evaluates on resize; returns a boolean so React only
 * re-renders when the answer flips.
 */
export function useBackdropFits(asset: BackdropGeometry, enabled: boolean): boolean {
  return useSyncExternalStore(
    subscribe,
    () => enabled && backdropFits(asset, readViewport()),
    () => false,
  )
}
