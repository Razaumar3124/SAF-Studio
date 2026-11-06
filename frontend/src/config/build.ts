/**
 * Build-time asset policy, imported by vite.config.ts. Pure and dependency-free so it can be unit-tested.
 *
 * Vite inlines assets smaller than 4 KB as `data:` URIs. The production CSP is `font-src 'self'`,
 * which BLOCKS `data:` fonts, and Plus Jakarta Sans ships a subset under 4 KB, so it silently failed
 * to load in production (audit 2026-11-06). Fonts are therefore never inlined. Returning `undefined`
 * keeps Vite's default rule for everything else.
 */
export function assetsInlineLimit(filePath: string): false | undefined {
  return /\.(woff2?|ttf|otf|eot)(\?.*)?$/i.test(filePath) ? false : undefined
}
