import { isEmail } from './identifier'
import { AUTH_LIMITS } from './limits'

export const PASSWORD_HINT = `Use at least ${AUTH_LIMITS.passwordMin} characters, including a letter and a number.`

export function validateEmailField(value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return 'Enter your email address.'
  if (trimmed.length > AUTH_LIMITS.email || !isEmail(trimmed)) {
    return 'Enter a valid email address.'
  }
  return undefined
}

export function validateOtpCode(value: string): string | undefined {
  const digits = value.trim()
  if (!digits) return 'Enter the 6-digit verification code.'
  if (!/^\d{6}$/.test(digits)) {
    return 'Verification code must be exactly 6 digits.'
  }
  return undefined
}

export function validatePasswordField(value: string): string | undefined {
  if (!value) return 'Create a new password.'
  if (
    value.length < AUTH_LIMITS.passwordMin ||
    !/\p{L}/u.test(value) ||
    !/\d/.test(value)
  ) {
    return PASSWORD_HINT
  }
  if (value.length > AUTH_LIMITS.password) {
    return `Password must be ${AUTH_LIMITS.password} characters or fewer.`
  }
  return undefined
}

export function validateConfirmPasswordField(
  password: string,
  confirmPassword: string
): string | undefined {
  if (!confirmPassword) return 'Confirm your new password.'
  if (password !== confirmPassword) {
    return 'Passwords do not match.'
  }
  return undefined
}

