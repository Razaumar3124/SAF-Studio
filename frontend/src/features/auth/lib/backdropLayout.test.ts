import { describe, expect, it } from 'vitest'
import { backdropStyle, objectPositionY, resolveBackdrop, type BackdropGeometry } from './backdropLayout'

const login: BackdropGeometry = {
  width: 1585,
  height: 992,
  cardSide: 'left',
  artEdge: 830 / 1585,
  captionEdge: 182 / 1585,
}

// Every hero-fits viewport we support (≥ 1024 wide, landscape ≥ 4:3) incl. short laptops and ultra-wide.
const VIEWPORTS = [
  [1024, 768],
  [1180, 820],
  [1280, 720],
  [1280, 800],
  [1366, 768],
  [1440, 900],
  [1536, 864],
  [1600, 900],
  [1920, 1080],
  [2560, 1440],
  [2560, 1080],
  [3440, 1440],
] as const

describe('backdropLayout (login)', () => {
  it.each(VIEWPORTS)('keeps the card clear of the art at %ix%i', (width, height) => {
    const r = resolveBackdrop(login, { width, height, barPx: 72 })
    expect(r.cardEnd).toBeLessThanOrEqual(r.art - 31) // ≥ ~2rem gap to the art
    expect(r.cardX).toBeGreaterThanOrEqual(16)
    expect(r.cardW).toBeGreaterThanOrEqual(22 * 16)
    expect(r.cardW).toBeLessThanOrEqual(34 * 16)
  })

  it('matches the mockup at its native 1585×992 canvas', () => {
    // Mockup: brand bar 75px, card 233→803, art from 830.
    const r = resolveBackdrop(login, { width: 1585, height: 992 + 75, barPx: 75 })
    expect(r.art).toBeCloseTo(830, 0)
    expect(r.cardW).toBeGreaterThan(520)
    expect(r.cardX).toBeGreaterThan(182) // right of the baked-in left captions
  })

  it('caps the backdrop box on ultra-wide screens so baked text is not cropped', () => {
    const r = resolveBackdrop(login, { width: 3440, height: 1440, barPx: 72 })
    expect(r.boxWidth).toBeLessThan(3440)
    // Vertical crop stays ≤ 16% (text spans ~9%–90% of the image height).
    const renderedHeight = (r.imageWidth * 992) / 1585
    expect(1 - (1440 - 72) / renderedHeight).toBeLessThanOrEqual(0.161)
  })

  it('emits CSS custom properties for the live layout', () => {
    const style = backdropStyle(login) as Record<string, string>
    expect(style['--box-x']).toContain('100cqw')
    expect(style['--art']).toContain('var(--box-x)')
    expect(style['--card-w']).toMatch(/^clamp\(22rem, /)
    expect(style['--card-x']).toContain('var(--zone-end)')
  })
})

/** Regression tests (audit 2026-11-06): bad geometry must never emit NaN/Infinity into CSS. */
describe('backdropLayout: malformed geometry and extreme viewports', () => {
  /** CSS custom properties that contain a non-number. */
  const badCss = (asset: BackdropGeometry) =>
    Object.entries(backdropStyle(asset) as Record<string, string>)
      .filter(([, value]) => /NaN|Infinity|undefined/.test(value))
      .map(([key]) => key)
  /** Resolved px values that aren't finite. */
  const badPx = (asset: BackdropGeometry, width = 1440, height = 900, barPx = 76) =>
    Object.entries(resolveBackdrop(asset, { width, height, barPx }))
      .filter(([, value]) => typeof value === 'number' && !Number.isFinite(value))
      .map(([key]) => key)

  it.each([
    ['zero size', { ...login, width: 0, height: 0 }],
    ['negative size', { ...login, width: -1585, height: 992 }],
    ['NaN size', { ...login, width: Number.NaN, height: 992 }],
    ['fractions out of range', { ...login, artEdge: 1.7, captionEdge: -0.2 }],
    ['NaN fractions', { ...login, artEdge: Number.NaN, captionEdge: Number.NaN }],
    ['captions beyond the art', { ...login, captionEdge: 0.9 }],
    ['extremely wide image', { ...login, width: 10_000, height: 100 }],
    ['extremely tall image', { ...login, width: 100, height: 10_000 }],
  ] as const)('%s → finite CSS and px', (_, asset) => {
    expect(badCss(asset)).toEqual([])
    expect(badPx(asset)).toEqual([])
  })

  it('treats captions on the wrong side of the art as "no captions"', () => {
    const r = resolveBackdrop({ ...login, captionEdge: 0.9 }, { width: 1440, height: 900, barPx: 76 })
    expect(r.zoneStart).toBe(24)
    expect(r.cardEnd).toBeLessThanOrEqual(r.art - 31)
  })

  it('survives a viewport shorter than the brand bar', () => {
    expect(badPx(login, 1440, 40, 76)).toEqual([])
  })
})

// Register backdrop as measured in Phase 3 (assets/auth.ts).
const register: BackdropGeometry = {
  width: 1672,
  height: 941,
  cardSide: 'right',
  artEdge: 990 / 1672,
  captionEdge: 1570 / 1672,
  maxAspect: 1.8,
}

describe('backdropLayout (register: right-hand card)', () => {
  it('places the card right of the art, clear of the window decor when there is room', () => {
    const r = resolveBackdrop(register, { width: 1440, height: 900, barPx: 76 })
    expect(r.fits).toBe(true)
    expect(r.cardX).toBeGreaterThanOrEqual(r.art + 31)
    expect(r.cardEnd).toBeLessThanOrEqual(r.zoneEnd + 0.5)
  })

  // Every viewport where the backdrop is shown must keep the card off the art and on screen.
  it.each(VIEWPORTS)('when it fits at %ix%i, the card is clear of the art and on screen', (width, height) => {
    const r = resolveBackdrop(register, { width, height, barPx: 76 })
    if (!r.fits) return
    expect(r.cardX).toBeGreaterThanOrEqual(r.art + 31)
    expect(r.cardEnd).toBeLessThanOrEqual(width)
    expect(r.cardW).toBeGreaterThanOrEqual(22 * 16)
  })

  it.each([
    [1366, 768],
    [1280, 800],
    [1440, 900],
    [1536, 864],
    [1920, 1080],
    [2560, 1440],
    [2560, 1080],
  ])('fits beside the art on laptops/desktops (%ix%i)', (width, height) => {
    expect(resolveBackdrop(register, { width, height, barPx: 76 }).fits).toBe(true)
  })

  it('does not fit at 4:3 (1024×768), so AuthLayout uses the image-free layout', () => {
    expect(resolveBackdrop(register, { width: 1024, height: 768, barPx: 76 }).fits).toBe(false)
  })

  it('never lets the zone run past the viewport when the image is cropped on the right', () => {
    // Narrow landscape: the image is wider than the viewport, so the window decor is off-screen.
    const r = resolveBackdrop(register, { width: 1180, height: 820, barPx: 76 })
    expect(r.zoneEnd).toBeLessThanOrEqual(1180 - 24)
  })

  // Regression: at 1920×1080 the default 1.9:1 cap clipped the baked "01 PERSONALISE…" steps.
  it.each([
    [1920, 1080],
    [2560, 1080],
    [3440, 1440],
    [2560, 1440],
  ])('keeps the baked tagline/steps and the top art inside the frame at %ix%i', (width, height) => {
    // Glyphs end ~2.5% above the bottom, art starts 4.5% from the top; objectPosition y = 60%.
    const r = resolveBackdrop(register, { width, height, barPx: 76 })
    const renderedH = (r.imageWidth * 941) / 1672
    const crop = Math.max(0, renderedH - (height - 76))
    expect(crop * 0.6).toBeLessThanOrEqual(0.045 * renderedH) // top crop
    expect(crop * 0.4).toBeLessThanOrEqual(0.025 * renderedH) // bottom crop
  })

  it('honours a per-asset maxAspect, and ignores nonsensical ones', () => {
    const vp = { width: 2560, height: 1080, barPx: 76 }
    expect(resolveBackdrop(register, vp).boxWidth).toBeCloseTo(1.8 * 1004, 5)
    expect(resolveBackdrop({ ...register, maxAspect: 0.2 }, vp).boxWidth).toBeCloseTo(1.9 * 1004, 5)
    expect(resolveBackdrop({ ...register, maxAspect: Number.NaN }, vp).boxWidth).toBeCloseTo(1.9 * 1004, 5)
  })
})

// Regression (user report): wide windows showed blank margins; fades now grow into the ambient fill,
// but must stop before baked text.
describe('backdropLayout: edge fades', () => {
  it('emits fade widths that grow with the margin and are capped by the asset safe edge', () => {
    const style = backdropStyle({ ...login, edgeFade: { card: 0.025, art: 0.012 } }) as Record<string, string>
    expect(style['--fade-card']).toBe('min(max(3rem, var(--box-x)), 0.025 * var(--bw), 10rem)')
    expect(style['--fade-art']).toBe('min(max(0.75rem, var(--box-x)), 0.012 * var(--bw), 6rem)')
  })

  it('defaults and clamps invalid fade fractions', () => {
    const def = backdropStyle(login) as Record<string, string>
    expect(def['--fade-card']).toContain('0.03 * var(--bw)')
    expect(def['--fade-art']).toContain('0.01 * var(--bw)')
    const bad = backdropStyle({ ...login, edgeFade: { card: Number.NaN, art: 5 } }) as Record<string, string>
    expect(bad['--fade-card']).toContain('0.03 * var(--bw)')
    expect(bad['--fade-art']).toContain('0.25 * var(--bw)')
  })
})

describe('backdropLayout: fits (login)', () => {
  it.each(VIEWPORTS)('login always fits on hero-fits viewports (%ix%i)', (width, height) => {
    expect(resolveBackdrop(login, { width, height, barPx: 76 }).fits).toBe(true)
  })
})

// Regression (user report: blurred side fill showed a seam): the edge fill is aligned with the
// rendered image, so backdropStyle exposes its height and top offset.
describe('backdropLayout: edge-fill alignment', () => {
  it('exposes the rendered image height and object-position top offset', () => {
    const style = backdropStyle({ ...login, objectPosition: '0% 60%' }) as Record<string, string>
    expect(style['--ih']).toBe(`calc(var(--iw) / ${Number((login.width / login.height).toFixed(4))})`)
    expect(style['--img-top']).toBe('calc((var(--hero-h) - var(--ih)) * 0.6)')
  })

  it.each([
    ['100% 50%', 0.5],
    ['0% 60%', 0.6],
    ['center top', 0],
    ['left bottom', 1],
    ['50% 250%', 1],
    ['50%', 0.5],
    [undefined, 0.5],
    ['garbage values', 0.5],
  ])('objectPositionY(%s) = %s', (pos, y) => {
    expect(objectPositionY(pos)).toBe(y)
  })
})

describe('backdropLayout: scaled root font (mouse desktops)', () => {
  it('defaults to 16px per rem and uses rootPx when given, like the CSS rem lengths', () => {
    const vp = { width: 1280, height: 720, barPx: 52 }
    expect(resolveBackdrop(login, vp)).toEqual(resolveBackdrop(login, { ...vp, rootPx: 16 }))
    const scaled = resolveBackdrop(login, { ...vp, rootPx: 13 })
    // Card width clamp(22rem, …, 34rem) and the 2rem art gap follow the root.
    expect(scaled.cardW).toBeGreaterThanOrEqual(22 * 13)
    expect(scaled.cardW).toBeLessThanOrEqual(34 * 13)
    expect(scaled.fits).toBe(true)
  })

  it('ignores an invalid rootPx', () => {
    const vp = { width: 1440, height: 900, barPx: 76 }
    expect(resolveBackdrop(register, { ...vp, rootPx: 0 })).toEqual(resolveBackdrop(register, vp))
    expect(resolveBackdrop(register, { ...vp, rootPx: Number.NaN })).toEqual(resolveBackdrop(register, vp))
  })

  it('a smaller rem lets Register fit beside the art at 1280×600', () => {
    expect(resolveBackdrop(register, { width: 1280, height: 600, barPx: 45.5, rootPx: 13 }).fits).toBe(true)
  })
})
