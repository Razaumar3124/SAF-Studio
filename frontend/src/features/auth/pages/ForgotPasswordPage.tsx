import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, Mail, ShieldCheck } from 'lucide-react'

import { authAssets } from '@/assets/auth'
import { Alert } from '@/components/feedback/Alert'
import { Button } from '@/components/ui/Button'
import { PasswordField } from '@/components/ui/PasswordField'
import { TextField } from '@/components/ui/TextField'
import { pageTitle } from '@/config/app'
import { ROUTES } from '@/config/routes'
import { api, isApiError } from '@/services/apiClient'
import { endpoints } from '@/services/endpoints'
import type {
  ForgotPasswordResponse,
  ResetPasswordResponse,
  VerifyOtpResponse,
} from '@/types/api'

import { AuthHeader } from '../components/AuthHeader'
import { AuthLayout } from '../components/AuthLayout'
import { AuthSwitchPrompt } from '../components/AuthSwitchPrompt'
import { OtpInput } from '../components/OtpInput'
import {
  PASSWORD_HINT,
  validateConfirmPasswordField,
  validateEmailField,
  validateOtpCode,
  validatePasswordField,
} from '../lib/forgotPasswordValidation'

type RecoveryStep = 'email' | 'otp' | 'password' | 'success'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()

  // Multi-step state
  const [step, setStep] = useState<RecoveryStep>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // UI status
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [cooldown, setCooldown] = useState(0)

  // Live countdown timer for OTP resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  // Clear errors when user edits
  const clearError = (field?: string) => {
    setFormError(null)
    if (field) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  // =========================================================================
  // STEP 1: Request OTP
  // =========================================================================
  const handleRequestOtp = async (e?: FormEvent) => {
    e?.preventDefault()
    clearError()

    const emailError = validateEmailField(email)
    if (emailError) {
      setFieldErrors({ email: emailError })
      return
    }

    setLoading(true)
    try {
      const res = await api.post<ForgotPasswordResponse>(endpoints.auth.forgotPassword, {
        email: email.trim().toLowerCase(),
      })
      setCooldown(res.cooldown_seconds || 60)
      setOtp('')
      setStep('otp')
    } catch (err) {
      if (isApiError(err)) {
        if (err.status === 429) {
          setFormError('Too many attempts. Please wait before requesting another code.')
        } else {
          setFormError(err.message || 'Unable to send verification code. Please try again.')
        }
      } else {
        setFormError('Network error. Check your connection and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  // =========================================================================
  // STEP 2: Verify OTP
  // =========================================================================
  const handleVerifyOtp = async (codeToVerify?: string) => {
    clearError()
    const targetOtp = codeToVerify ?? otp
    const otpError = validateOtpCode(targetOtp)
    if (otpError) {
      setFieldErrors({ otp: otpError })
      return
    }

    setLoading(true)
    try {
      const res = await api.post<VerifyOtpResponse>(endpoints.auth.verifyOtp, {
        email: email.trim().toLowerCase(),
        otp: targetOtp.trim(),
      })
      setResetToken(res.reset_token)
      setStep('password')
    } catch (err) {
      if (isApiError(err)) {
        setFormError(err.message || 'Incorrect verification code. Please check and try again.')
      } else {
        setFormError('Failed to verify code. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (cooldown > 0 || resending) return
    clearError()
    setResending(true)
    try {
      const res = await api.post<ForgotPasswordResponse>(endpoints.auth.forgotPassword, {
        email: email.trim().toLowerCase(),
      })
      setCooldown(res.cooldown_seconds || 60)
      setOtp('')
    } catch (err) {
      if (isApiError(err)) {
        setFormError(err.message || 'Unable to resend verification code.')
      }
    } finally {
      setResending(false)
    }
  }

  // =========================================================================
  // STEP 3: Reset Password
  // =========================================================================
  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault()
    clearError()

    if (!resetToken) {
      setFormError('Your reset session has expired. Please restart recovery.')
      setStep('email')
      return
    }

    const pwdError = validatePasswordField(newPassword)
    const confirmError = validateConfirmPasswordField(newPassword, confirmPassword)
    if (pwdError || confirmError) {
      setFieldErrors({
        ...(pwdError && { newPassword: pwdError }),
        ...(confirmError && { confirmPassword: confirmError }),
      })
      return
    }

    setLoading(true)
    try {
      await api.post<ResetPasswordResponse>(endpoints.auth.resetPassword, {
        reset_token: resetToken,
        new_password: newPassword,
      })
      setResetToken(null)
      setStep('success')
    } catch (err) {
      if (isApiError(err)) {
        setFormError(err.message || 'Unable to update password. Please try again.')
      } else {
        setFormError('Failed to update password. Check your connection.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout hero={authAssets.login.backdrop} variant="login">
      <title>{pageTitle('Reset Password')}</title>

      <div className="flex flex-col gap-(--auth-stack-gap)">
        {/* ================================================================ */}
        {/* STEP 1: Enter Email                                             */}
        {/* ================================================================ */}
        {step === 'email' && (
          <>
            <AuthHeader
              eyebrow="Account recovery"
              title="Forgot Password?"
              subtitle="Enter your registered email and we’ll send a 6-digit verification code."
            />

            {formError && <Alert tone="error">{formError}</Alert>}

            <form onSubmit={handleRequestOtp} noValidate className="flex flex-col gap-4">
              <TextField
                label="Email Address"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                error={fieldErrors.email}
                leftIcon={<Mail aria-hidden className="size-5" />}
                onChange={(e) => {
                  setEmail(e.target.value)
                  clearError('email')
                }}
                disabled={loading}
              />

              <Button
                type="submit"
                variant="primary-gradient"
                size="lg"
                fullWidth
                loading={loading}
                loadingText="Sending code…"
                rightIcon={<ArrowRight aria-hidden className="size-4.5" />}
              >
                Send Verification Code
              </Button>
            </form>

            <AuthSwitchPrompt
              prompt="Remembered your password?"
              linkLabel="Back to sign in"
              to={ROUTES.login}
            />
          </>
        )}

        {/* ================================================================ */}
        {/* STEP 2: Verify 6-digit OTP                                      */}
        {/* ================================================================ */}
        {step === 'otp' && (
          <>
            <AuthHeader
              eyebrow="Verification code"
              title="Enter Security Code."
              subtitle={`We sent a 6-digit verification code to ${email}`}
            />

            {formError && <Alert tone="error">{formError}</Alert>}

            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="recovery-otp-input"
                  className="text-[length:var(--field-label-text)] font-semibold text-ink-800"
                >
                  6-Digit Verification Code
                </label>
                <OtpInput
                  id="recovery-otp-input"
                  value={otp}
                  onChange={(val) => {
                    setOtp(val)
                    clearError('otp')
                  }}
                  onComplete={(code) => handleVerifyOtp(code)}
                  hasError={Boolean(fieldErrors.otp || formError)}
                  disabled={loading}
                />
                {fieldErrors.otp && (
                  <p className="text-xs text-crimson-600 font-medium">{fieldErrors.otp}</p>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-ink-600">
                <button
                  type="button"
                  onClick={() => {
                    clearError()
                    setStep('email')
                  }}
                  className="font-medium text-brand-700 hover:text-brand-800 hover:underline"
                >
                  Change email address
                </button>

                {cooldown > 0 ? (
                  <span className="text-ink-500 font-mono">
                    Resend in {Math.floor(cooldown / 60)}:
                    {(cooldown % 60).toString().padStart(2, '0')}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resending || loading}
                    className="font-semibold text-brand-700 hover:text-brand-800 hover:underline disabled:opacity-50"
                  >
                    {resending ? 'Sending…' : 'Resend code'}
                  </button>
                )}
              </div>

              <Button
                type="button"
                variant="primary-gradient"
                size="lg"
                fullWidth
                loading={loading}
                loadingText="Verifying code…"
                onClick={() => handleVerifyOtp()}
                disabled={otp.length !== 6}
                rightIcon={<ArrowRight aria-hidden className="size-4.5" />}
              >
                Verify Code
              </Button>
            </div>

            <AuthSwitchPrompt
              prompt="Remembered your password?"
              linkLabel="Back to sign in"
              to={ROUTES.login}
            />
          </>
        )}

        {/* ================================================================ */}
        {/* STEP 3: Create New Password                                     */}
        {/* ================================================================ */}
        {step === 'password' && (
          <>
            <AuthHeader
              eyebrow="Secure account"
              title="Create New Password."
              subtitle="Enter your new password below to regain access to your account."
            />

            {formError && <Alert tone="error">{formError}</Alert>}

            <form onSubmit={handleResetPassword} noValidate className="flex flex-col gap-4">
              <PasswordField
                label="New Password"
                placeholder="At least 8 characters"
                value={newPassword}
                error={fieldErrors.newPassword}
                hint={PASSWORD_HINT}
                onChange={(e) => {
                  setNewPassword(e.target.value)
                  clearError('newPassword')
                }}
                disabled={loading}
              />

              <PasswordField
                label="Confirm New Password"
                placeholder="Re-enter your new password"
                value={confirmPassword}
                error={fieldErrors.confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  clearError('confirmPassword')
                }}
                disabled={loading}
              />

              <Button
                type="submit"
                variant="primary-gradient"
                size="lg"
                fullWidth
                loading={loading}
                loadingText="Updating password…"
                rightIcon={<ShieldCheck aria-hidden className="size-5" />}
              >
                Update Password
              </Button>
            </form>

            <button
              type="button"
              onClick={() => {
                clearError()
                setStep('email')
              }}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-ink-600 hover:text-ink-900 transition-colors"
            >
              <ArrowLeft aria-hidden className="size-3.5" /> Start over
            </button>
          </>
        )}

        {/* ================================================================ */}
        {/* STEP 4: Success Confirmation                                    */}
        {/* ================================================================ */}
        {step === 'success' && (
          <>
            <AuthHeader
              eyebrow="All set"
              title="Password Reset."
              subtitle="Your account password has been successfully updated."
            />

            <div className="flex flex-col items-center gap-4 rounded-xl border border-success-600/30 bg-success-50/50 p-6 text-center">
              <div className="grid size-12 place-items-center rounded-full bg-success-100 text-success-700">
                <CheckCircle2 aria-hidden className="size-7" />
              </div>

              <div className="flex flex-col gap-1">
                <h3 className="font-semibold text-ink-900">Recovery Complete</h3>
                <p className="text-sm text-ink-600">
                  You can now sign in using your updated password.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="primary-gradient"
              size="lg"
              fullWidth
              onClick={() => navigate(ROUTES.login, { replace: true })}
              rightIcon={<ArrowRight aria-hidden className="size-4.5" />}
            >
              Sign In to Your Account
            </Button>
          </>
        )}
      </div>
    </AuthLayout>
  )
}
