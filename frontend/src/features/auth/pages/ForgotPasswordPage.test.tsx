// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/services/apiClient'
import ForgotPasswordPage from './ForgotPasswordPage'

vi.mock('@/services/apiClient', async () => {
  const actual = await vi.importActual<typeof import('@/services/apiClient')>('@/services/apiClient')
  return {
    ...actual,
    api: {
      post: vi.fn(),
    },
  }
})

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders Step 1 (Enter Email) initially with proper heading', () => {
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: /forgot password\?/i })).toBeTruthy()
    expect(screen.getByLabelText(/email address/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /send verification code/i })).toBeTruthy()
  })

  it('validates email and transitions to Step 2 on successful OTP request', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      message: 'If an account is associated with this email, a verification code was sent.',
      cooldown_seconds: 60,
    })

    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    )

    const emailInput = screen.getByLabelText(/email address/i)
    fireEvent.change(emailInput, { target: { value: 'customer@safstudio.com' } })

    const submitBtn = screen.getByRole('button', { name: /send verification code/i })
    await act(async () => {
      fireEvent.click(submitBtn)
    })

    expect(api.post).toHaveBeenCalledWith('/auth/forgot-password', {
      email: 'customer@safstudio.com',
    })

    // Should now be on Step 2 (OTP)
    expect(screen.getByRole('heading', { name: /enter security code/i })).toBeTruthy()
    expect(screen.getByRole('group', { name: /6-digit verification code/i })).toBeTruthy()
  })

  it('completes the full recovery flow through Step 2, Step 3, and Step 4', async () => {
    // 1. Mock Step 1 response
    vi.mocked(api.post).mockResolvedValueOnce({
      message: 'Code sent',
      cooldown_seconds: 60,
    })

    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    )

    // Step 1: Submit email
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'customer@safstudio.com' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send verification code/i }))
    })

    // Step 2: Submit OTP
    vi.mocked(api.post).mockResolvedValueOnce({
      reset_token: 'rst_test_session_token_12345',
      expires_in_seconds: 600,
    })

    const otpInputs = screen.getAllByRole('textbox')
    const firstOtpInput = otpInputs[0]
    expect(firstOtpInput).toBeTruthy()
    if (firstOtpInput) {
      await act(async () => {
        fireEvent.paste(firstOtpInput, {
          clipboardData: { getData: () => '123456' },
        })
      })
    }

    expect(api.post).toHaveBeenCalledWith('/auth/forgot-password/verify', {
      email: 'customer@safstudio.com',
      otp: '123456',
    })

    // Step 3: Now on New Password screen
    expect(screen.getByRole('heading', { name: /create new password/i })).toBeTruthy()

    vi.mocked(api.post).mockResolvedValueOnce({
      message: 'Password successfully reset.',
    })

    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: 'NewSecurePassword123!' },
    })
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: 'NewSecurePassword123!' },
    })

    const updateBtn = screen.getByRole('button', { name: /update password/i })
    await act(async () => {
      fireEvent.click(updateBtn)
    })

    expect(api.post).toHaveBeenCalledWith('/auth/forgot-password/reset', {
      reset_token: 'rst_test_session_token_12345',
      new_password: 'NewSecurePassword123!',
    })

    // Step 4: Now on Success screen
    expect(screen.getByRole('heading', { name: /password reset/i })).toBeTruthy()
    expect(screen.getByText(/recovery complete/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /sign in to your account/i })).toBeTruthy()
  })
})
