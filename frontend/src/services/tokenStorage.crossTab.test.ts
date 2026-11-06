// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Regression test (audit 2026-11-06): the session is cached in memory, so before the fix a sign-out
 * (or sign-in as someone else) in another tab was ignored here until reload, and this tab kept
 * sending the old Bearer token. Browsers fire `storage` events in the OTHER tabs only; we
 * simulate one.
 */
const KEY = 'saf.auth'
const tokens = { access_token: 'acc', refresh_token: 'ref', token_type: 'bearer' as const, expires_in: 3600 }

async function load() {
  localStorage.clear()
  vi.resetModules()
  return (await import('./tokenStorage')).tokenStorage
}

const otherTabWrites = (newValue: string | null) => {
  if (newValue === null) localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, newValue)
  window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue }))
}

describe('tokenStorage across tabs', () => {
  afterEach(() => localStorage.clear())

  it('forgets the cached session when another tab signs out', async () => {
    const tokenStorage = await load()
    tokenStorage.save(tokens)
    expect(tokenStorage.getAccessToken()).toBe('acc')
    otherTabWrites(null)
    expect(tokenStorage.getAccessToken()).toBeNull()
    expect(tokenStorage.hasSession()).toBe(false)
  })

  it('picks up a session saved by another tab', async () => {
    const tokenStorage = await load()
    expect(tokenStorage.getAccessToken()).toBeNull() // primes the cache with "no session"
    otherTabWrites(
      JSON.stringify({ accessToken: 'other', refreshToken: 'r2', expiresAt: Date.now() + 60_000 }),
    )
    expect(tokenStorage.getAccessToken()).toBe('other')
  })

  it('ignores storage events for unrelated keys', async () => {
    const tokenStorage = await load()
    tokenStorage.save(tokens)
    window.dispatchEvent(new StorageEvent('storage', { key: 'something-else', newValue: 'x' }))
    expect(tokenStorage.getAccessToken()).toBe('acc')
  })

  it('a storage.clear() in another tab (key null) also ends the session', async () => {
    const tokenStorage = await load()
    tokenStorage.save(tokens)
    localStorage.clear()
    window.dispatchEvent(new StorageEvent('storage', { key: null }))
    expect(tokenStorage.hasSession()).toBe(false)
  })
})
