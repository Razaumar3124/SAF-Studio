import { describe, expect, it } from 'vitest'
import viteConfigSource from '../../vite.config.ts?raw'
import { assetsInlineLimit } from './build'

describe('assetsInlineLimit (CSP: font-src self)', () => {
  it.each([
    'a.woff2',
    'b.WOFF',
    '/x/plus-jakarta-sans-vietnamese-wght-normal.woff2',
    'c.ttf',
    'd.otf',
    'e.woff2?v=1',
  ])('never inlines font %s', (file) => expect(assetsInlineLimit(file)).toBe(false))

  it.each(['logo.svg', 'icon.png', 'woff2.svg', 'x.woff2.svg'])('keeps the default for %s', (file) =>
    expect(assetsInlineLimit(file)).toBeUndefined(),
  )

  it('is wired into vite.config.ts', () => {
    expect(viteConfigSource).toMatch(/assetsInlineLimit,/)
    expect(viteConfigSource).toContain("from './src/config/build.ts'")
  })
})
