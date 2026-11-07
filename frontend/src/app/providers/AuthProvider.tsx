import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getMe, login as apiLogin, loginWithGoogle as apiLoginWithGoogle, logout as apiLogout } from '@/services/authApi'
import { setUnauthorizedHandler } from '@/services/apiClient'
import { tokenStorage } from '@/services/tokenStorage'
import type { GoogleAuthResponse, LoginRequest, LoginResponse, User } from '@/types/api'

export interface AuthContextValue {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  login: (request: LoginRequest, signal?: AbortSignal) => Promise<LoginResponse>
  loginWithGoogle: (idToken: string, signal?: AbortSignal) => Promise<GoogleAuthResponse>
  logout: (signal?: AbortSignal) => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Restore session on mount (silent refresh via httpOnly cookie + fetch user)
  useEffect(() => {
    let mounted = true

    async function initSession() {
      if (!tokenStorage.hasSession()) {
        if (mounted) {
          setUser(null)
          setLoading(false)
        }
        return
      }

      try {
        const currentUser = await getMe()
        if (mounted) {
          setUser(currentUser)
        }
      } catch {
        if (mounted) {
          tokenStorage.clear()
          setUser(null)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void initSession()

    // Register handler for unrecoverable 401s across the application
    setUnauthorizedHandler(() => {
      if (mounted) {
        setUser(null)
      }
    })

    return () => {
      mounted = false
      setUnauthorizedHandler(null)
    }
  }, [])

  const login = useCallback(async (request: LoginRequest, signal?: AbortSignal): Promise<LoginResponse> => {
    const response = await apiLogin(request, signal)
    if (response?.tokens) {
      tokenStorage.save(response.tokens)
    }
    if (response?.user) {
      setUser(response.user as User)
    }
    return response
  }, [])

  const loginWithGoogle = useCallback(
    async (idToken: string, signal?: AbortSignal): Promise<GoogleAuthResponse> => {
      const response = await apiLoginWithGoogle({ id_token: idToken }, signal)
      if (response?.tokens) {
        tokenStorage.save(response.tokens)
      }
      if (response?.user) {
        setUser(response.user)
      }
      return response
    },
    [],
  )

  const logout = useCallback(async (signal?: AbortSignal): Promise<void> => {
    try {
      await apiLogout(signal)
    } catch {
      // Ignore network errors on logout to guarantee local sign-out
    } finally {
      tokenStorage.clear()
      setUser(null)
    }
  }, [])

  const refreshUser = useCallback(async (): Promise<void> => {
    try {
      const profile = await getMe()
      setUser(profile)
    } catch {
      tokenStorage.clear()
      setUser(null)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      loginWithGoogle,
      logout,
      refreshUser,
    }),
    [user, loading, login, loginWithGoogle, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    // Safe standalone fallback for isolated tests rendered without AuthProvider
    return {
      user: null,
      loading: false,
      isAuthenticated: tokenStorage.hasSession(),
      login: async (request: LoginRequest, signal?: AbortSignal) => {
        const response = await apiLogin(request, signal)
        if (response?.tokens) {
          tokenStorage.save(response.tokens)
        }
        return response
      },
      loginWithGoogle: async (idToken: string, signal?: AbortSignal) => {
        const response = await apiLoginWithGoogle({ id_token: idToken }, signal)
        if (response?.tokens) {
          tokenStorage.save(response.tokens)
        }
        return response
      },
      logout: async (signal?: AbortSignal) => {
        try {
          await apiLogout(signal)
        } catch {
          // ignore
        } finally {
          tokenStorage.clear()
        }
      },
      refreshUser: async () => {},
    }
  }
  return context
}
