import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/providers/AuthProvider'
import { Alert } from '@/components/feedback/Alert'
import { env } from '@/config/env'
import { ROUTES } from '@/config/routes'
import { loginWithGoogle } from '@/services/authApi'
import { tokenStorage } from '@/services/tokenStorage'
import { GoogleButton } from './GoogleButton'

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
  const buttonContainerRef = useRef<HTMLDivElement>(null)
  const inFlightRef = useRef(false)

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

  useEffect(() => {
    const clientId = env.googleClientId
    if (!clientId) return

    const setupGis = () => {
      if (typeof window === 'undefined' || !window.google?.accounts?.id) {
        return false
      }

      try {
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

        if (buttonContainerRef.current) {
          buttonContainerRef.current.innerHTML = ''
          window.google.accounts.id.renderButton(buttonContainerRef.current, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'center',
            width: 380,
            locale: 'en',
          })
          if (buttonContainerRef.current.children.length > 0) {
            setHasRenderedIframe(true)
          }
        }

        return true
      } catch {
        return false
      }
    }

    let interval: NodeJS.Timeout | number | undefined
    let timeout: NodeJS.Timeout | number | undefined

    if (!setupGis()) {
      interval = setInterval(() => {
        if (setupGis()) {
          clearInterval(interval)
        }
      }, 100)
      timeout = setTimeout(() => clearInterval(interval), 5000)
    }

    return () => {
      if (interval) clearInterval(interval)
      if (timeout) clearTimeout(timeout)
    }
  }, [])

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

      <div className="relative flex justify-center w-full min-h-[44px]">
        {/* Official Google Identity Services button container */}
        <div
          ref={buttonContainerRef}
          className={hasRenderedIframe && !submitting ? 'w-full flex justify-center' : 'hidden'}
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
