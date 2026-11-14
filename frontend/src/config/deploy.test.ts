import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import viteConfigSource from '../../vite.config.ts?raw'
import { resolveBuildApiBaseUrl } from './deploy'

const publicFile = (name: string) => readFileSync(new URL(`../../public/${name}`, import.meta.url), 'utf8')

describe('resolveBuildApiBaseUrl', () => {
  it('defaults to the dev proxy path outside Cloudflare Pages', () => {
    expect(resolveBuildApiBaseUrl(undefined, false)).toBe('/api/v1')
    expect(resolveBuildApiBaseUrl('/api/v1', false)).toBe('/api/v1')
  })

  it('accepts an absolute https API URL on Cloudflare Pages and strips trailing slashes', () => {
    expect(resolveBuildApiBaseUrl('https://api.example.com/api/v1/', true)).toBe(
      'https://api.example.com/api/v1',
    )
  })

  it('fails the Cloudflare Pages build when the API URL is relative or missing', () => {
    expect(() => resolveBuildApiBaseUrl('/api/v1', true)).toThrow(/absolute https:\/\//)
    expect(() => resolveBuildApiBaseUrl(undefined, true)).toThrow(/VITE_API_BASE_URL/)
    expect(() => resolveBuildApiBaseUrl('http://api.example.com', true)).toThrow(
      /VITE_API_BASE_URL|https:\/\//,
    )
  })

  it('is wired into vite.config.ts with the CF_PAGES flag', () => {
    expect(viteConfigSource).toContain("from './src/config/deploy.ts'")
    expect(viteConfigSource).toContain("env.CF_PAGES === '1'")
  })
})

describe('Cloudflare Pages routing and headers', () => {
  it('serves index.html for every route (SPA fallback)', () => {
    expect(publicFile('_redirects')).toMatch(/^\/\*\s+\/index\.html\s+200$/m)
  })

  it('sends the security headers, including frame-ancestors (not expressible in <meta>)', () => {
    const headers = publicFile('_headers')
    expect(headers).toMatch(/^\/\*$/m)
    expect(headers).toContain('X-Content-Type-Options: nosniff')
    expect(headers).toContain('X-Frame-Options: DENY')
    expect(headers).toContain("Content-Security-Policy: frame-ancestors 'none'")
    expect(headers).toMatch(/Strict-Transport-Security: max-age=\d+/)
  })
})
