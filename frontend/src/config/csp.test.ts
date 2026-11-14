import { describe, expect, it } from 'vitest'
import viteConfigSource from '../../vite.config.ts?raw'
import { buildContentSecurityPolicy, GOOGLE_IDENTITY_ORIGIN } from './csp'

function directives(policy: string): Record<string, string[]> {
  return Object.fromEntries(
    policy.split(';').map((part) => {
      const [name, ...values] = part.trim().split(/\s+/)
      return [name, values]
    }),
  )
}

describe('buildContentSecurityPolicy', () => {
  const policy = buildContentSecurityPolicy('https://api.example.com/api/v1')
  const d = directives(policy)

  it('allows the Google Identity Services script, frame and connections', () => {
    expect(d['script-src']).toEqual(["'self'", GOOGLE_IDENTITY_ORIGIN])
    expect(d['frame-src']).toEqual([GOOGLE_IDENTITY_ORIGIN])
    expect(d['connect-src']).toContain(GOOGLE_IDENTITY_ORIGIN)
  })

  it('keeps scripts same-origin apart from Google, and blocks objects and framing of the page', () => {
    expect(d['script-src']).not.toContain("'unsafe-inline'")
    expect(d['object-src']).toEqual(["'none'"])
    expect(policy).not.toContain('frame-ancestors') // not valid in <meta>; sent via _headers
  })

  it('allows the API origin (and only its origin) for requests and images', () => {
    expect(d['connect-src']).toContain('https://api.example.com')
    expect(d['img-src']).toContain('https://api.example.com')
    expect(policy).not.toContain('/api/v1')
  })

  it('omits the API origin for a relative (dev proxy) base URL', () => {
    const relative = directives(buildContentSecurityPolicy('/api/v1'))
    expect(relative['connect-src']).toEqual(["'self'", GOOGLE_IDENTITY_ORIGIN])
  })

  it('is wired into vite.config.ts', () => {
    expect(viteConfigSource).toContain("from './src/config/csp.ts'")
    expect(viteConfigSource).not.toContain("script-src 'self'\"")
  })
})
