import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/providers/AuthProvider'
import { Alert } from '@/components/feedback/Alert'
import { env } from '@/config/env'
import { ROUTES } from '@/config/routes'
import { loginWithGoogle } from '@/services/authApi'
import { tokenStorage } from '@/services/tokenStorage'
import { GoogleButton } from './GoogleButton'

const MIN_GIS_BUTTON_WIDTH = 200
const MAX_GIS_BUTTON_WIDTH = 400
const DEFAULT_GIS_BUTTON_WIDTH = 320
const RESIZE_DEBOUNCE_MS = 100

/**
 * Clamp the Google Identity Services button width to GIS's supported range [200, 400]
 * while staying within the card's measured content width.
 */
function computeGisButtonWidth(containerWidth: number): number {
  if (containerWidth <= 0) return DEFAULT_GIS_BUTTON_WIDTH
  return Math.min(MAX_GIS_BUTTON_WIDTH, Math.max(MIN_GIS_BUTTON_WIDTH, Math.floor(containerWidth)))
}

export interface GoogleSignInProps {
  /**
   * Action context:
   * - 'register': user onboarding flow.
   * - 'login': returning user authentication flow.
   */
  action?: 'register' | 'login'
}

/**
 * "Continue with Google" Single Sign-On (SSO).
 * Supports both Login and Register via official Google Identity Services (GIS)
 * and POST /api/v1/auth/google.
 */
export function GoogleSignIn({ action = 'login' }: GoogleSignInProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { refreshUser } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasRenderedIframe, setHasRenderedIframe] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const buttonContainerRef = useRef<HTMLDivElement>(null)
  const inFlightRef = useRef(false)
  const gisInitializedRef = useRef(false)
  const lastRenderedWidthRef = useRef<number | null>(null)
  const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const isRegister = action === 'register'
  const loadingText = isRegister ? 'Creating account…' : 'Signing in…'

  const handleCredentialSuccess = useCallback(
    async (idToken: string) => {
      // Prevent duplicate token exchanges if GIS fires multiple callbacks
      if (inFlightRef.current) return
      inFlightRef.current = true

      setSubmitting(true)
      setError(null)

      try {
        const response = await loginWithGoogle({ id_token: idToken })
        if (response?.tokens) {
          tokenStorage.save(response.tokens)
        }
        await refreshUser()

        const from = (location.state as { from?: string } | null)?.from
        const target =
          from && typeof from === 'string' && from.startsWith('/') && !from.startsWith('/login')
            ? from
            : ROUTES.memoryWall
        navigate(target, { replace: true })
      } catch (err: unknown) {
        let message = isRegister
          ? 'Google registration failed. Please try again.'
          : 'Google sign-in failed. Please try again.'

        if (err && typeof err === 'object' && 'code' in err) {
          const apiErr = err as { code?: string; message?: string }
          if (apiErr.code === 'ACCOUNT_DISABLED') {
            message = 'This account has been deactivated. Please contact support.'
          } else if (apiErr.code === 'INVALID_GOOGLE_TOKEN') {
            message = apiErr.message || 'Google account verification failed. Please try again.'
          } else if (apiErr.message) {
            message = apiErr.message
          }
        } else if (err instanceof Error) {
          message = err.message
        }
        setError(message)
      } finally {
        setSubmitting(false)
        inFlightRef.current = false
      }
    },
    [isRegister, location.state, navigate, refreshUser],
  )

  const handleCredentialSuccessRef = useRef(handleCredentialSuccess)
  useEffect(() => {
    handleCredentialSuccessRef.current = handleCredentialSuccess
  }, [handleCredentialSuccess])

  const renderGisButton = useCallback(() => {
    const wrapper = wrapperRef.current
    const container = buttonContainerRef.current
    if (!wrapper || !container || !window.google?.accounts?.id) {
      return false
    }

    const targetWidth = computeGisButtonWidth(wrapper.getBoundingClientRect().width)
    if (lastRenderedWidthRef.current === targetWidth && container.children.length > 0) {
      return true
    }

    container.innerHTML = ''
    window.google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'center',
      width: targetWidth,
      locale: 'en',
    })
    lastRenderedWidthRef.current = targetWidth
    if (container.children.length > 0) {
      setHasRenderedIframe(true)
    }
    return true
  }, [])

  useEffect(() => {
    const clientId = env.googleClientId
    if (!clientId) return

    const setupGis = () => {
      if (typeof window === 'undefined' || !window.google?.accounts?.id) {
        return false
      }

      try {
        if (!gisInitializedRef.current) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response) => {
              if (response.credential) {
                void handleCredentialSuccessRef.current(response.credential)
              } else {
                setError('No credentials received from Google. Please try again.')
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          })
          gisInitializedRef.current = true
        }

        renderGisButton()
        return true
      } catch {
        return false
      }
    }

    let interval: ReturnType<typeof setInterval> | undefined
    let timeout: ReturnType<typeof setTimeout> | undefined

    if (!setupGis()) {
      interval = setInterval(() => {
        if (setupGis()) {
          clearInterval(interval)
        }
      }, 100)
      timeout = setTimeout(() => clearInterval(interval), 5000)
    }

    const handleContainerResize = () => {
      if (!gisInitializedRef.current || !wrapperRef.current) return
      if (wrapperRef.current.getBoundingClientRect().width <= 0) return

      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current)
      resizeTimeoutRef.current = setTimeout(() => {
        renderGisButton()
      }, RESIZE_DEBOUNCE_MS)
    }

    let observer: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined' && wrapperRef.current) {
      observer = new ResizeObserver(handleContainerResize)
      observer.observe(wrapperRef.current)
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleContainerResize)
    }

    return () => {
      if (interval) clearInterval(interval)
      if (timeout) clearTimeout(timeout)
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
        resizeTimeoutRef.current = undefined
      }
      observer?.disconnect()
      if (!observer && typeof window !== 'undefined') {
        window.removeEventListener('resize', handleContainerResize)
      }
      gisInitializedRef.current = false
      lastRenderedWidthRef.current = null
    }
  }, [renderGisButton])

  const handleButtonClick = () => {
    if (!env.googleClientId) {
      setError('Google Sign-In is not configured. Please set VITE_GOOGLE_CLIENT_ID in your environment.')
      return
    }

    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed()) {
          setError(
            'Google One Tap could not be displayed. Please check your browser privacy or third-party cookie settings.',
          )
        }
      })
    } else {
      setError('Google Identity Services is loading. Please check your connection and try again.')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="error">{error}</Alert>}

      <div ref={wrapperRef} className="relative flex min-h-[44px] w-full items-center justify-center">
        {/* Official Google Identity Services button container */}
        <div
          ref={buttonContainerRef}
          className={hasRenderedIframe && !submitting ? 'flex w-full max-w-full justify-center' : 'hidden'}
        />

        {/* Fallback button when GIS is loading, not initialized, iframe not inserted, or submitting */}
        {(!hasRenderedIframe || submitting) && (
          <GoogleButton
            loading={submitting}
            loadingText={loadingText}
            disabled={submitting}
            onClick={handleButtonClick}
          />
        )}
      </div>
    </div>
  )
}
