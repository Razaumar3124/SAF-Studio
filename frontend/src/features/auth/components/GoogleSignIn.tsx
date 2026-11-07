import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert } from '@/components/feedback/Alert'
import { env } from '@/config/env'
import { ROUTES } from '@/config/routes'
import { loginWithGoogle } from '@/services/authApi'
import { tokenStorage } from '@/services/tokenStorage'
import { GoogleButton } from './GoogleButton'

export interface GoogleSignInProps {
  /**
   * Action context:
   * - 'register': Google SSO active (for Register page).
   * - 'login': placeholder notice (Login page, deferred to next phase).
   */
  action?: 'register' | 'login'
}

/**
 * "Continue with Google".
 * - On Register page (action="register"): Google Identity Services flow → POST /api/v1/auth/google.
 * - On Login page (action="login"): shows the placeholder notice.
 */
export function GoogleSignIn({ action = 'login' }: GoogleSignInProps) {
  const navigate = useNavigate()
  const [showNotice, setShowNotice] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasRenderedIframe, setHasRenderedIframe] = useState(false)
  const buttonContainerRef = useRef<HTMLDivElement>(null)

  const isRegister = action === 'register'

  const handleCredentialSuccess = useCallback(
    async (idToken: string) => {
      setSubmitting(true)
      setError(null)

      try {
        const response = await loginWithGoogle({ id_token: idToken })
        if (response?.tokens) {
          tokenStorage.save(response.tokens)
        }
        navigate(ROUTES.memoryWall, { replace: true })
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Google registration failed. Please try again.'
        setError(message)
      } finally {
        setSubmitting(false)
      }
    },
    [navigate],
  )

  const handleCredentialSuccessRef = useRef(handleCredentialSuccess)
  useEffect(() => {
    handleCredentialSuccessRef.current = handleCredentialSuccess
  }, [handleCredentialSuccess])

  useEffect(() => {
    if (!isRegister) return

    const clientId = env.googleClientId
    if (!clientId) return

    const setupGis = () => {
      if (typeof window === 'undefined' || !window.google?.accounts?.id) {
        return false
      }

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
  }, [isRegister])

  const handleButtonClick = () => {
    if (!isRegister) {
      setShowNotice(true)
      return
    }

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
      {showNotice && (
        <Alert tone="info">
          Google sign-in is coming soon. Please use your mobile number or email for now.
        </Alert>
      )}

      {isRegister ? (
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
              loadingText="Creating account…"
              disabled={submitting}
              onClick={handleButtonClick}
            />
          )}
        </div>
      ) : (
        <GoogleButton onClick={handleButtonClick} />
      )}
    </div>
  )
}
