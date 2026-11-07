import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeStorage } from '@/test/fakeStorage'

const KEY = 'saf.auth'

// tokenStorage caches in module scope, so each test gets a fresh module + storage.
async function load(initial: Record<string, string> = {}) {
  const storage = createFakeStorage(initial)
  vi.stubGlobal('localStorage', storage)
  vi.resetModules()
  const { tokenStorage } = await import('./tokenStorage')
  return { tokenStorage, storage }
}

const tokens = { access_token: 'acc', refresh_token: 'ref', token_type: 'bearer' as const, expires_in: 3600 }

describe('tokenStorage', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('saves, reads and clears a session with in-memory access token and httpOnly refresh', async () => {
    const { tokenStorage, storage } = await load()
    tokenStorage.save(tokens)
    expect(tokenStorage.getAccessToken()).toBe('acc')
    // Refresh tokens are never exposed in JavaScript memory (stored in httpOnly cookie)
    expect(tokenStorage.getRefreshToken()).toBeNull()
    // Sensitive JWT tokens are NEVER persisted to localStorage
    expect(storage.getItem(KEY)).toBeNull()
    expect(storage.getItem('saf.has_session')).toBe('1')
    tokenStorage.clear()
    expect(tokenStorage.hasSession()).toBe(false)
    expect(storage.getItem('saf.has_session')).toBeNull()
  })

  it('does not return an expired access token but still reports the session', async () => {
    vi.useFakeTimers()
    const { tokenStorage } = await load()
    tokenStorage.save(tokens)
    vi.advanceTimersByTime(3600 * 1000)
    expect(tokenStorage.getAccessToken()).toBeNull()
    expect(tokenStorage.hasSession()).toBe(true)
  })

  it.each([
    ['invalid JSON', '{nope'],
    ['wrong shape', JSON.stringify({ accessToken: 42, refreshToken: 'r', expiresAt: 1 })],
    ['empty token', JSON.stringify({ accessToken: '', refreshToken: 'r', expiresAt: 9e15 })],
    ['non-finite expiry', JSON.stringify({ accessToken: 'a', refreshToken: 'r', expiresAt: 'soon' })],
    ['array', '[]'],
  ])('discards tampered storage (%s)', async (_label, raw) => {
    const { tokenStorage, storage } = await load({ [KEY]: raw })
    expect(tokenStorage.getAccessToken()).toBeNull()
    expect(tokenStorage.hasSession()).toBe(false)
    expect(storage.getItem(KEY)).toBeNull()
  })

  it('treats a missing or garbled expires_in as already expired (never "forever")', async () => {
    const { tokenStorage } = await load()
    tokenStorage.save({ ...tokens, expires_in: Number.NaN })
    expect(tokenStorage.getAccessToken()).toBeNull()
  })

  it('keeps working in memory when storage throws (private mode / blocked)', async () => {
    const throwing = createFakeStorage()
    throwing.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    vi.stubGlobal('localStorage', throwing)
    vi.resetModules()
    const { tokenStorage } = await import('./tokenStorage')
    expect(() => tokenStorage.save(tokens)).not.toThrow()
    expect(tokenStorage.getAccessToken()).toBe('acc')
  })
})
