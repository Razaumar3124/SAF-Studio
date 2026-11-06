import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Regression tests for the fluid auth sizing (index.css `[data-auth]` tokens; user report: oversized
 * controls, scrolling on short laptops and phones). Evaluates the real CSS formulas at given viewports
 * with a tiny parser (no eval): clamp(MIN, min(TERM, TERM) | TERM, MAX), TERM = sum of px/vw/dvh.
 */
const css = readFileSync(new URL('../../../index.css', import.meta.url), 'utf-8')

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  expect(start).toBeGreaterThan(-1)
  const body = css.slice(start, css.indexOf('}', start))
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/(--[\w-]+):\s*([^;]+);/g))
    out[m[1] as string] = (m[2] as string).replace(/\s+/g, ' ').trim()
  return out
}

const login = block('[data-auth]')
const register = { ...login, ...block('[data-auth][data-compact]') }

type Viewport = { w: number; h: number }

function sum(expr: string, v: Viewport): number {
  let total = 0
  for (const m of expr.matchAll(/([+-]?)\s*(\d+(?:\.\d+)?)(px|vw|dvh|rem)/g)) {
    const n = Number(m[2]) * (m[1] === '-' ? -1 : 1)
    const unit = m[3]
    total += unit === 'px' ? n : unit === 'rem' ? n * 16 : unit === 'vw' ? (n * v.w) / 100 : (n * v.h) / 100
  }
  return total
}

function size(tokens: Record<string, string>, name: string, v: Viewport): number {
  let raw = tokens[name]
  expect(raw).toBeDefined()
  // Follow `var(--x)` aliases (e.g. --auth-cta-h: var(--field-h)).
  for (let ref = /^var\((--[\w-]+)\)$/.exec(raw ?? ''); ref; ref = /^var\((--[\w-]+)\)$/.exec(raw ?? ''))
    raw = tokens[ref[1] as string]
  const m = /^clamp\(\s*([\d.]+rem),\s*(?:min\((.+),\s*(.+)\)|([^,]+)),\s*([\d.]+rem)\s*\)$/.exec(raw ?? '')
  expect(m).toBeTruthy()
  const [, lo, a, b, single, hi] = m as RegExpExecArray
  const fluid = single ? sum(single, v) : Math.min(sum(a as string, v), sum(b as string, v))
  return Math.min(sum(hi as string, v), Math.max(sum(lo as string, v), fluid))
}

const LOGIN_MOCKUP = {
  '--auth-title': 52,
  '--auth-subtitle': 18,
  '--auth-prompt': 16,
  '--field-h': 52,
  '--field-label-gap': 8,
  '--auth-cta-h': 52,
  '--auth-cta-text': 17,
  '--auth-alt-h': 48,
  '--auth-card-px': 40,
  '--auth-card-py': 40,
  '--auth-zone-py': 32,
  '--auth-stack-gap': 32,
  '--auth-header-gap': 12,
  '--auth-section-gap': 24,
  '--auth-form-gap': 20,
}

describe('fluid auth tokens', () => {
  it.each([
    { w: 1440, h: 900 },
    { w: 1920, h: 1080 },
    { w: 2560, h: 1440 },
  ])('Login is exactly the desktop mockup at full size ($w×$h)', (v) => {
    for (const [name, px] of Object.entries(LOGIN_MOCKUP))
      expect({ [name]: Math.round(size(login, name, v)) }).toEqual({ [name]: px })
  })

  it('Register reaches its full mockup values at 1920×1080', () => {
    const v = { w: 1920, h: 1080 }
    expect(size(register, '--auth-title', v)).toBeCloseTo(44, 0)
    expect(size(register, '--field-h', v)).toBeCloseTo(52, 0)
    expect(size(register, '--auth-card-py', v)).toBeCloseTo(40, 0)
  })

  it('shrinks with the viewport: every token is monotonic in width and in height', () => {
    for (const tokens of [login, register])
      for (const name of Object.keys(LOGIN_MOCKUP)) {
        let prev = 0
        for (const w of [320, 390, 768, 1024, 1280, 1440]) {
          const s = size(tokens, name, { w, h: 900 })
          expect(s).toBeGreaterThanOrEqual(prev - 1e-9)
          prev = s
        }
        prev = 0
        for (const h of [390, 568, 589, 720, 768, 900]) {
          const s = size(tokens, name, { w: 1440, h })
          expect(s).toBeGreaterThanOrEqual(prev - 1e-9)
          prev = s
        }
      }
  })

  it('never goes below legible / tappable minimums (phones, short laptops)', () => {
    // Register has its own, lower floors (see 'Register no-scroll tokens' below).
    for (const tokens of [login])
      for (const v of [
        { w: 320, h: 568 },
        { w: 390, h: 844 },
        { w: 1263, h: 589 },
        { w: 844, h: 390 },
      ]) {
        expect(size(tokens, '--field-h', v)).toBeGreaterThanOrEqual(40)
        expect(size(tokens, '--auth-cta-h', v)).toBeGreaterThanOrEqual(40)
        expect(size(tokens, '--auth-alt-h', v)).toBeGreaterThanOrEqual(40)
        expect(size(tokens, '--auth-title', v)).toBeGreaterThanOrEqual(28)
        expect(size(tokens, '--auth-subtitle', v)).toBeGreaterThanOrEqual(15)
        expect(size(tokens, '--auth-prompt', v)).toBeGreaterThanOrEqual(14)
      }
  })

  it('is compact at 1263×589 (1920×1080 at 150 % scaling) so Login fits under the bar', () => {
    const v = { w: 1263, h: 589 }
    expect(size(login, '--auth-title', v)).toBeCloseTo(30, 0)
    expect(size(login, '--field-h', v)).toBeCloseTo(40, 0)
    expect(size(login, '--auth-card-py', v)).toBeCloseTo(16, 0)
    expect(size(login, '--auth-stack-gap', v)).toBeCloseTo(12, 0)
  })
})

/**
 * Laptop layer (user report: card oversized on 13–14" laptops at 125–150 % scaling). Only ≥ 1024px
 * wide viewports may match, so phones and tablets keep the fluid tokens above, byte for byte.
 */
describe('laptop auth tokens (≥ 1024px)', () => {
  const start = css.indexOf('LAPTOPS AND SMALL DESKTOPS')
  const section = css.slice(start, css.indexOf('html {', start))
  const queries = [...section.matchAll(/@media ([^{]+)\{/g)].map((m) => (m[1] as string).trim())
  const laptopBlock = section.slice(section.indexOf('{', section.indexOf('@media')) + 1)
  const laptop: Record<string, string> = {}
  for (const m of laptopBlock.slice(0, laptopBlock.indexOf('}')).matchAll(/(--[\w-]+):\s*([^;]+);/g))
    laptop[m[1] as string] = (m[2] as string).replace(/\s+/g, ' ').trim()
  const tokens = { ...login, ...laptop }

  it('has the laptop section', () => {
    expect(start).toBeGreaterThan(-1)
  })

  it('never matches below 1024px: every media query requires min-width: 64rem', () => {
    expect(queries.length).toBeGreaterThanOrEqual(2)
    for (const q of queries) expect(q.startsWith('(min-width: 64rem) and')).toBe(true)
  })

  it('has the requested compact values', () => {
    const v = { w: 1366, h: 768 }
    expect(size(tokens, '--field-h', v)).toBeGreaterThanOrEqual(42)
    expect(size(tokens, '--field-h', v)).toBeLessThanOrEqual(46)
    expect(size(tokens, '--auth-cta-h', v)).toBe(size(tokens, '--field-h', v))
    expect(size(tokens, '--auth-alt-h', v)).toBe(size(tokens, '--field-h', v))
    expect(size(tokens, '--auth-title', { w: 1366, h: 768 })).toBeLessThanOrEqual(36)
    expect(laptop['--auth-subtitle']).toBe('0.875rem')
    expect(laptop['--field-label-text']).toBe('0.8125rem')
    expect(laptop['--auth-card-px']).toBe('1.75rem') // 28px, inside 24–32
    expect(laptop['--auth-card-max']).toBe('26rem') // 416px, inside 380–420
    for (const gap of ['--auth-header-gap', '--auth-section-gap', '--auth-form-gap'])
      expect(parseFloat(laptop[gap] as string) * 16).toBeLessThanOrEqual(14)
    expect(size(tokens, '--auth-stack-gap', { w: 1366, h: 768 })).toBeLessThanOrEqual(14)
    expect(size(tokens, '--auth-card-py', { w: 1366, h: 768 })).toBeGreaterThanOrEqual(16)
    expect(size(tokens, '--auth-card-py', { w: 1366, h: 768 })).toBeLessThanOrEqual(28)
  })

  it('still reaches 40px controls on the shortest laptops (1263×589) and shrinks with height', () => {
    expect(size(tokens, '--field-h', { w: 1263, h: 589 })).toBeCloseTo(40, 0)
    expect(size(tokens, '--field-h', { w: 1440, h: 900 })).toBe(44)
    expect(size(tokens, '--auth-title', { w: 1263, h: 589 })).toBeLessThan(
      size(tokens, '--auth-title', { w: 1440, h: 900 }),
    )
  })

  it('new field tokens default to the previous fixed sizes outside laptops (mobile / tablet unchanged)', () => {
    const at = css.indexOf('--field-label-text: 0.875rem')
    expect(at).toBeGreaterThan(-1)
    const root: Record<string, string> = {}
    for (const m of css
      .slice(css.lastIndexOf('{', at), css.indexOf('}', at))
      .matchAll(/(--[\w-]+):\s*([^;]+);/g))
      root[m[1] as string] = (m[2] as string).trim()
    expect(root['--field-label-text']).toBe('0.875rem')
    expect(root['--field-text']).toBe('1rem') // iOS never zooms on focus
    expect(root['--field-icon']).toBe('1.25rem')
    expect(root['--field-toggle']).toBe('2.5rem')
    expect(login['--auth-alt-text']).toBe('1rem')
    expect(login['--auth-btn-icon']).toBe('1.25rem')
    expect(login['--auth-card-max']).toBe('100vw')
  })

  it('reduces input text only for mouse / trackpad laptops (touch keeps 16px)', () => {
    // The only rules that shrink input text are behind `(pointer: fine)` (the scaled desktop layer).
    const fine = queries.filter((q) => q.includes('(pointer: fine)'))
    expect(fine).toEqual(['(min-width: 64rem) and (pointer: fine)'])
    const fineAt = section.indexOf(`@media ${fine[0]} {`)
    expect(section.slice(fineAt)).toContain('--field-text: max(0.9375rem, 12px)')
    // Touch laptops: neither the laptop layer nor any other non-fine query sets a smaller input text.
    expect(laptop['--field-text']).toBeUndefined()
    expect(section.slice(0, fineAt)).not.toMatch(/--field-text:\s*0\.9375rem/)
  })
})

/**
 * Register no-scroll tokens (user report: Register scrolled where Login didn't). Linear in viewport
 * height from a compact anchor (600px tall) to the mockup (1080px tall); browser-measured fit lives in
 * docs/RESPONSIVE.md. These lock the formulas so the fit can't silently regress.
 */
describe('Register no-scroll tokens', () => {
  const at = (name: string, h: number, w = 1366) => size(register, name, { w, h })

  it('is declared after the Login and laptop blocks, so it wins for Register only', () => {
    const registerAt = css.indexOf('REGISTER (5 fields')
    expect(registerAt).toBeGreaterThan(css.indexOf('LAPTOPS AND SMALL DESKTOPS'))
    expect(css.indexOf('[data-auth][data-compact] {')).toBeGreaterThan(registerAt)
    // Login / laptop blocks no longer target Register.
    expect(css.slice(0, registerAt)).not.toContain('[data-compact]')
  })

  it('reaches the mockup at 1080px tall and the compact set at ≤ 600px tall', () => {
    expect(at('--auth-title', 1080, 1920)).toBeCloseTo(44, 0)
    expect(at('--field-h', 1080, 1920)).toBeCloseTo(52, 0)
    expect(at('--auth-card-py', 1080, 1920)).toBeCloseTo(40, 0)
    expect(at('--field-h', 600)).toBeCloseTo(36, 0)
    expect(at('--auth-title', 600)).toBeCloseTo(24, 0)
    expect(at('--auth-subtitle', 600)).toBeCloseTo(13, 0)
    expect(at('--auth-form-gap', 600)).toBeCloseTo(7, 0)
    expect(at('--auth-card-py', 600)).toBeCloseTo(10, 0)
  })

  it('base sizes on a 1366×768 laptop sit between the two (≈ 42px controls)', () => {
    expect(at('--field-h', 768)).toBeGreaterThan(40)
    expect(at('--field-h', 768)).toBeLessThan(44)
    expect(at('--auth-cta-h', 768)).toBe(at('--field-h', 768))
  })

  it('every token grows monotonically with height', () => {
    const names = [
      '--auth-title',
      '--auth-subtitle',
      '--auth-prompt',
      '--field-h',
      '--field-label-gap',
      '--field-label-text',
      '--field-hint-text',
      '--field-icon',
      '--field-toggle',
      '--auth-cta-text',
      '--auth-alt-h',
      '--auth-alt-text',
      '--auth-btn-icon',
      '--auth-card-py',
      '--auth-zone-py',
      '--auth-stack-gap',
      '--auth-header-gap',
      '--auth-section-gap',
      '--auth-form-gap',
    ]
    for (const name of names) {
      let prev = 0
      for (const h of [390, 568, 600, 667, 720, 768, 900, 1080, 1440]) {
        const s = at(name, h)
        expect(s).toBeGreaterThanOrEqual(prev - 1e-9)
        prev = s
      }
    }
  })

  it('keeps legible / clickable floors even on the shortest screens', () => {
    for (const h of [390, 568, 589]) {
      expect(at('--field-h', h)).toBeGreaterThanOrEqual(34)
      expect(at('--auth-alt-h', h)).toBeGreaterThanOrEqual(36)
      expect(at('--auth-title', h)).toBeGreaterThanOrEqual(22)
      expect(at('--auth-subtitle', h)).toBeGreaterThanOrEqual(13)
      expect(at('--field-label-text', h)).toBeGreaterThanOrEqual(13)
      expect(at('--field-hint-text', h)).toBeGreaterThanOrEqual(12)
    }
    expect(register['--field-text']).toBe('1rem') // 16px input text: iOS never zooms
  })

  it('leaves Login sizes untouched: new TextField tokens default to the old fixed values', () => {
    const rootAt = css.indexOf('--field-hint-text: 0.875rem')
    const root = css.slice(css.lastIndexOf('{', rootAt), css.indexOf('}', rootAt))
    expect(root).toContain('--field-hint-text: 0.875rem') // = text-sm
    expect(root).toContain('--field-label-leading: 1.25rem') // = leading-5
  })
})

/**
 * Scaled desktop layer (user request: Login / Register as compact as the SAF reference on a 1280×720
 * screen, proportionally larger on 1920×1080 and 2560×1440). Mouse / trackpad ≥ 1024px only: the root
 * font follows the viewport and every token is a fixed rem, so the whole page scales as one.
 */
describe('scaled desktop auth (≥ 1024px, pointer: fine)', () => {
  const start = css.indexOf('SCALED DESKTOP AUTH (Login')
  const query = '@media (min-width: 64rem) and (pointer: fine) {'
  const section = css.slice(css.indexOf(query, start), css.indexOf('html {', start))
  const rule = (selector: string) => {
    const at = section.indexOf(`${selector} {`)
    expect(at).toBeGreaterThan(-1)
    const out: Record<string, string> = {}
    for (const m of section.slice(at, section.indexOf('}', at)).matchAll(/(--[\w-]+):\s*([^;]+);/g))
      out[m[1] as string] = (m[2] as string).trim()
    return out
  }
  const desk = rule('[data-auth]')
  const deskRegister = rule('[data-auth][data-compact]')

  /** The root formula, evaluated as CSS would (vh = layout viewport height). */
  const rootPx = (w: number, h: number) =>
    Math.min(20, Math.max(13, Math.min((0.7026 * w) / 100 + 4, (1.5 * h) / 100 + 4)))
  /** A token value in px at a given root: `Xrem`, `max(Xrem, Ypx)` or `var(--alias)`. */
  const px = (tokens: Record<string, string>, name: string, root: number): number => {
    const raw = tokens[name] ?? desk[name]
    expect(raw).toBeDefined()
    const alias = /^var\((--[\w-]+)\)$/.exec(raw as string)
    if (alias) return px(tokens, alias[1] as string, root)
    const floor = /^max\(([\d.]+)rem,\s*([\d.]+)px\)$/.exec(raw as string)
    if (floor) return Math.max(Number(floor[1]) * root, Number(floor[2]))
    const rem = /^([\d.]+)rem$/.exec(raw as string)
    expect(rem).toBeTruthy()
    return Number((rem as RegExpExecArray)[1]) * root
  }

  it('is declared last, for mouse / trackpad screens ≥ 1024px only (touch keeps the 16px layers)', () => {
    expect(start).toBeGreaterThan(css.indexOf('REGISTER (5 fields'))
    expect(css.indexOf(query, start)).toBeGreaterThan(start)
    expect(section).toContain('--auth-root: clamp(13px, min(0.7026vw + 4px, 1.5vh + 4px), 20px)')
    expect(section).toContain(':root:has([data-auth]) {')
    expect(css).toMatch(/@property --auth-root \{\s*syntax: '<length>';/)
  })

  it.each([
    [1280, 720, 13],
    [1280, 600, 13],
    [1366, 768, 13.6],
    [1920, 1080, 17.5],
    [2560, 1440, 20],
  ])('root font at %i×%i is %fpx', (w, h, expected) => {
    expect(rootPx(w, h)).toBeCloseTo(expected, 1)
  })

  it('uses fixed rem tokens only (no px / viewport terms that would not scale with the root)', () => {
    for (const tokens of [desk, deskRegister])
      for (const [name, value] of Object.entries(tokens)) {
        if (name === '--field-label-leading' && value === '1.25') continue // unitless line-height
        expect({ [name]: value }).toEqual({
          [name]: expect.stringMatching(/^(?:[\d.]+rem|max\([\d.]+rem, 1[12]px\)|var\(--[\w-]+\))$/),
        })
      }
  })

  it('matches the SAF reference (80 % of the 1592×738 sizes) at 1280×720', () => {
    const r = rootPx(1280, 720)
    expect(px(desk, '--auth-title', r)).toBeCloseTo(26.5, 0)
    expect(px(desk, '--field-h', r)).toBeCloseTo(35.75, 1)
    expect(px(desk, '--auth-card-max', r)).toBeCloseTo(338, 0)
    expect(px(deskRegister, '--auth-title', r)).toBeCloseTo(24.2, 0)
    expect(px(deskRegister, '--field-h', r)).toBeCloseTo(33, 0)
    expect(px(deskRegister, '--auth-alt-h', r)).toBeCloseTo(32, 0)
  })

  it('keeps text floors: 12px body / labels / inputs / buttons, 11px small text', () => {
    const r = 13
    for (const tokens of [desk, deskRegister]) {
      for (const name of [
        '--auth-subtitle',
        '--auth-prompt',
        '--field-label-text',
        '--field-text',
        '--auth-cta-text',
        '--auth-alt-text',
      ])
        expect(px(tokens, name, r)).toBeGreaterThanOrEqual(12)
      expect(px(tokens, '--field-hint-text', r)).toBeGreaterThanOrEqual(11)
    }
    expect(px(desk, '--text-xs', r)).toBeGreaterThanOrEqual(11)
    expect(px(desk, '--text-sm', r)).toBeGreaterThanOrEqual(12)
  })

  it('grows proportionally on large screens without exceeding the full-size mockup', () => {
    const big = rootPx(2560, 1440)
    expect(px(desk, '--field-h', big)).toBeLessThanOrEqual(56)
    expect(px(desk, '--auth-title', big)).toBeLessThanOrEqual(52)
    expect(px(deskRegister, '--auth-title', big)).toBeLessThanOrEqual(44)
    expect(px(desk, '--field-h', rootPx(1920, 1080))).toBeGreaterThan(
      px(desk, '--field-h', rootPx(1280, 720)),
    )
  })
})
