/// <reference types="node" />
// Node types for this test only: Vitest doesn't process CSS by default, so `colors.css?raw` resolves
// to an empty string here. The file is read from disk instead (the test runs in Node).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const colorsCss = readFileSync(new URL('./colors.css', import.meta.url), 'utf8')

/**
 * Guards the contrast table in docs/DESIGN_SYSTEM.md against token edits. Ratios are computed from
 * colors.css itself (WCAG 2.2 relative luminance). Text pairs need 4.5:1, UI boundaries 3:1.
 */
const tokens = Object.fromEntries(
  [...colorsCss.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]),
) as Record<string, string>

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(fg: string, bg: string) {
  const a = tokens[fg]
  const b = tokens[bg]
  if (!a || !b) throw new Error(`Unknown token ${a ? bg : fg}`)
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

const TEXT: ReadonlyArray<[fg: string, bg: string]> = [
  ['ink-900', 'surface'],
  ['ink-800', 'surface'],
  ['ink-700', 'surface'],
  ['ink-600', 'surface'],
  ['ink-600', 'mist-100'],
  ['ink-500', 'surface'], // placeholders/helper text: white surfaces only
  ['brand-700', 'surface'], // links, eyebrows, "OR"
  ['brand-700', 'mist-100'], // Alert info icon/links on mist
  ['surface', 'brand-600'], // primary button label; also the LIGHTEST stop of the gradient CTA
  ['surface', 'brand-700'], // gradient CTA end / hover
  ['danger-600', 'surface'], // field error text
  ['danger-700', 'danger-50'], // Alert error text
  ['success-600', 'surface'],
  ['gold-600', 'surface'],
  ['ink-700', 'mist-100'], // Alert info text
  ['ink-900', 'success-50'], // Alert success text
]

const NON_TEXT: ReadonlyArray<[fg: string, bg: string]> = [
  ['ink-400', 'surface'], // field boundaries, Switch off-state border
  ['brand-600', 'surface'], // focus ring, selected states, Switch on
  ['danger-600', 'surface'], // error field border
]

describe('design-token contrast (WCAG 2.2 AA)', () => {
  it.each(TEXT)('text %s on %s ≥ 4.5:1', (fg, bg) => expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5))
  it.each(NON_TEXT)('UI %s on %s ≥ 3:1', (fg, bg) => expect(contrast(fg, bg)).toBeGreaterThanOrEqual(3))
})
