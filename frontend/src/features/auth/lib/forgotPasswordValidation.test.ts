import { describe, expect, it } from 'vitest'
import {
  PASSWORD_HINT,
  validateConfirmPasswordField,
  validateEmailField,
  validateOtpCode,
  validatePasswordField,
} from './forgotPasswordValidation'

describe('validateEmailField', () => {
  it('accepts valid email addresses', () => {
    expect(validateEmailField('customer@safstudio.com')).toBeUndefined()
    expect(validateEmailField('aarav.sharma@example.co.in')).toBeUndefined()
  })

  it('rejects empty or invalid email addresses', () => {
    expect(validateEmailField('')).toMatch(/enter your email/i)
    expect(validateEmailField('   ')).toMatch(/enter your email/i)
    expect(validateEmailField('notanemail')).toMatch(/valid email/i)
    expect(validateEmailField('missing@domain')).toMatch(/valid email/i)
  })
})

describe('validateOtpCode', () => {
  it('accepts strictly 6-digit codes', () => {
    expect(validateOtpCode('123456')).toBeUndefined()
    expect(validateOtpCode('000000')).toBeUndefined()
    expect(validateOtpCode('987654')).toBeUndefined()
  })

  it('rejects invalid or incomplete codes', () => {
    expect(validateOtpCode('')).toMatch(/enter the 6-digit/i)
    expect(validateOtpCode('12345')).toMatch(/exactly 6 digits/i)
    expect(validateOtpCode('1234567')).toMatch(/exactly 6 digits/i)
    expect(validateOtpCode('12345a')).toMatch(/exactly 6 digits/i)
    expect(validateOtpCode('abcdef')).toMatch(/exactly 6 digits/i)
  })
})

describe('validatePasswordField', () => {
  it('accepts compliant passwords', () => {
    expect(validatePasswordField('Password123!')).toBeUndefined()
    expect(validatePasswordField('StudioPass2026')).toBeUndefined()
  })

  it('rejects passwords that are too short or missing letters/digits', () => {
    expect(validatePasswordField('')).toMatch(/create a new password/i)
    expect(validatePasswordField('short1')).toBe(PASSWORD_HINT)
    expect(validatePasswordField('onlyletters')).toBe(PASSWORD_HINT)
    expect(validatePasswordField('12345678')).toBe(PASSWORD_HINT)
  })
})

describe('validateConfirmPasswordField', () => {
  it('accepts matching passwords', () => {
    expect(validateConfirmPasswordField('SecretPass123!', 'SecretPass123!')).toBeUndefined()
  })

  it('rejects mismatched or empty passwords', () => {
    expect(validateConfirmPasswordField('SecretPass123!', '')).toMatch(/confirm your new password/i)
    expect(validateConfirmPasswordField('SecretPass123!', 'DifferentPass456!')).toMatch(/passwords do not match/i)
  })
})

