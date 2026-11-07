import type { AuthTokens } from '@/types/api'

/**
 * Manages JWT access token in memory and tracks session persistence.
 *
 * Security architecture:
 * - Access tokens are short-lived and kept STRICTLY IN MEMORY (module scope).
 *   They are never persisted to localStorage or sessionStorage, mitigating XSS token theft.
 * - Refresh tokens are long-lived and managed exclusively via secure httpOnly cookies
 *   set by the backend (SameSite=Lax, Path=/api/v1/auth). They are inaccessible to JS.
 * - Only a non-sensitive boolean indicator (`saf.has_session`) is recorded in localStorage
 *   so that page reloads know to trigger silent refresh via POST /api/v1/auth/refresh.
 */

const SESSION_FLAG_KEY = 'saf.has_session'
const LEGACY_STORAGE_KEY = 'saf.auth'

interface InMemorySession {
  accessToken: string
  /** Epoch ms when the access token expires. */
  expiresAt: number
}

let inMemorySession: InMemorySession | null = null

function isStoredSession(value: unknown): value is { accessToken: string; expiresAt: number } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.accessToken === 'string' &&
    v.accessToken.length > 0 &&
    typeof v.expiresAt === 'number' &&
    Number.isFinite(v.expiresAt)
  )
}

function readSession(): InMemorySession | null {
  if (inMemorySession !== null) return inMemorySession

  let raw: string | null = null
  try {
    raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isStoredSession(parsed)) {
        inMemorySession = {
          accessToken: parsed.accessToken,
          expiresAt: parsed.expiresAt,
        }
        localStorage.removeItem(LEGACY_STORAGE_KEY)
        localStorage.setItem(SESSION_FLAG_KEY, '1')
        return inMemorySession
      }
    }
  } catch {
    // Parsing failed
  }

  // Drop corrupted, non-object or invalid legacy entries so they can't linger
  if (raw && !inMemorySession) {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {
      // Storage unavailable
    }
  }

  return inMemorySession
}

// Another tab signed out or cleared storage: clear in-memory session
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === SESSION_FLAG_KEY || event.key === LEGACY_STORAGE_KEY || event.key === null) {
      if (!event.newValue || event.key === null) {
        inMemorySession = null
        try {
          localStorage.removeItem(SESSION_FLAG_KEY)
        } catch {
          // ignore
        }
      } else if (event.key === LEGACY_STORAGE_KEY && event.newValue) {
        try {
          const parsed: unknown = JSON.parse(event.newValue)
          if (isStoredSession(parsed)) {
            inMemorySession = {
              accessToken: parsed.accessToken,
              expiresAt: parsed.expiresAt,
            }
            return
          }
        } catch {
          // ignore
        }
        inMemorySession = null
      }
    }
  })
}

export const tokenStorage = {
  save(tokens: AuthTokens) {
    const lifetimeSeconds =
      Number.isFinite(tokens.expires_in) && tokens.expires_in > 0 ? tokens.expires_in : 0
    inMemorySession = {
      accessToken: tokens.access_token,
      expiresAt: Date.now() + lifetimeSeconds * 1000,
    }
    try {
      localStorage.setItem(SESSION_FLAG_KEY, '1')
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {
      // Storage blocked (private browsing mode) - session stays in memory for this tab
    }
  },

  /** Returns the access token, or null if missing or expired. */
  getAccessToken(): string | null {
    const session = readSession()
    if (!session) return null
    if (Date.now() >= session.expiresAt) return null
    return session.accessToken
  },

  /** True if an active session exists or was flagged in storage for silent refresh. */
  hasSession(): boolean {
    const session = readSession()
    if (session && Date.now() < session.expiresAt) return true
    try {
      return localStorage.getItem(SESSION_FLAG_KEY) === '1'
    } catch {
      return false
    }
  },

  /**
   * Refresh tokens are stored exclusively in secure httpOnly cookies.
   * This method returns null to ensure refresh tokens are never held in JS memory.
   */
  getRefreshToken(): string | null {
    return null
  },

  setAccessToken(token: string, expiresInSeconds: number) {
    const lifetimeSeconds =
      Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 ? expiresInSeconds : 0
    inMemorySession = {
      accessToken: token,
      expiresAt: Date.now() + lifetimeSeconds * 1000,
    }
    try {
      localStorage.setItem(SESSION_FLAG_KEY, '1')
    } catch {
      // Storage blocked
    }
  },

  clear() {
    inMemorySession = null
    try {
      localStorage.removeItem(SESSION_FLAG_KEY)
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {
      // Storage blocked
    }
  },
}
