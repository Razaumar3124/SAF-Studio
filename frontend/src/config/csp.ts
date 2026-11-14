/**
 * Production Content-Security-Policy, built at compile time by vite.config.ts and injected as a
 * <meta> tag (dev server is excluded: it needs inline scripts for HMR). Pure, so it is unit-tested.
 *
 * `frame-ancestors` cannot be expressed in a <meta> tag; it is sent as an HTTP header from
 * public/_headers on Cloudflare Pages.
 */

/** Google Identity Services (Sign in with Google) loads its script and renders its button in an iframe. */
export const GOOGLE_IDENTITY_ORIGIN = 'https://accounts.google.com'

export function buildContentSecurityPolicy(apiBaseUrl: string): string {
  const apiOrigin = /^https?:\/\//i.test(apiBaseUrl) ? new URL(apiBaseUrl).origin : ''
  return [
    "default-src 'self'",
    `script-src 'self' ${GOOGLE_IDENTITY_ORIGIN}`,
    // style-src needs 'unsafe-inline' for React `style` attributes (e.g. hero object-position).
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${apiOrigin}`.trim(),
    "font-src 'self'",
    `connect-src 'self' ${apiOrigin} ${GOOGLE_IDENTITY_ORIGIN}`.trim(),
    `frame-src ${GOOGLE_IDENTITY_ORIGIN}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}
