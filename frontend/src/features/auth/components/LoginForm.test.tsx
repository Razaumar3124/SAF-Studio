// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/services/apiClient'
import * as authApi from '@/services/authApi'
import { tokenStorage } from '@/services/tokenStorage'
import type { GoogleAuthResponse, LoginResponse } from '@/types/api'
import { LoginForm } from './LoginForm'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const mockLoginSuccessResponse: LoginResponse = {
  user: {
    id: '672cf1a9e4b0123456789abc',
    email: 'aarav@example.com',
    full_name: 'Aarav Sharma',
    phone: '+919876543210',
    role: 'customer',
    is_active: true,
  },
  tokens: {
    access_token: 'test-login-jwt-access-token',
    refresh_token: 'test-login-secure-refresh-token',
    token_type: 'bearer',
    expires_in: 1800,
  },
}

const mockGoogleSuccessResponse: GoogleAuthResponse = {
  user: {
    id: '672cf1a9e4b0123456789abc',
    email: 'aarav@example.com',
    full_name: 'Aarav Sharma',
    phone: '+919876543210',
    role: 'customer',
    is_active: true,
    created_at: '2026-11-08T00:00:00.000Z',
  },
  tokens: {
    access_token: 'test-google-jwt-access-token',
    refresh_token: 'test-google-secure-refresh-token',
    token_type: 'bearer',
    expires_in: 1800,
  },
}

function renderAt(element: ReactNode, initialEntries = ['/']) {
  const router = createMemoryRouter(
    [
      { path: '/', element },
      { path: '/memory-wall', element: <h1>Planner</h1> },
      { path: '/forgot-password', element: <h1>Forgot Password Page</h1> },
    ],
    { initialEntries },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('LoginForm integration', () => {
  it('authenticates with email and navigates to /memory-wall on success', async () => {
    const spy = vi.spyOn(authApi, 'login').mockResolvedValue(mockLoginSuccessResponse)
    const tokenSaveSpy = vi.spyOn(tokenStorage, 'save')

    renderAt(<LoginForm />)

    await userEvent.type(screen.getByLabelText('Mobile No. or Email'), 'aarav@example.com')
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'SecurePassword123!')
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        { email: 'aarav@example.com', password: 'SecurePassword123!' },
        expect.any(AbortSignal),
      )
    })

    expect(tokenSaveSpy).toHaveBeenCalledWith(mockLoginSuccessResponse.tokens)
    expect(await screen.findByRole('heading', { name: 'Planner' })).toBeTruthy()
  })

  it('authenticates with Indian mobile number (+91 normalised) on success', async () => {
    const spy = vi.spyOn(authApi, 'login').mockResolvedValue(mockLoginSuccessResponse)

    renderAt(<LoginForm />)

    // User types 10-digit number with spaces or trunk prefix: 098765 43210
    await userEvent.type(screen.getByLabelText('Mobile No. or Email'), '098765 43210')
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'SecurePassword123!')
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        { phone: '+919876543210', password: 'SecurePassword123!' },
        expect.any(AbortSignal),
      )
    })

    expect(await screen.findByRole('heading', { name: 'Planner' })).toBeTruthy()
  })

  it('displays generic error alert on 401 invalid credentials', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValue(
      new ApiError({
        status: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Those details don’t match our records. Check them and try again.',
      }),
    )

    renderAt(<LoginForm />)

    await userEvent.type(screen.getByLabelText('Mobile No. or Email'), 'wrong@example.com')
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'WrongPassword123!')
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/Those details don’t match our records/i)
  })

  it('displays rate-limit error on 429 too many attempts', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValue(
      new ApiError({
        status: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many sign-in attempts. Please wait a minute and try again.',
      }),
    )

    renderAt(<LoginForm />)

    await userEvent.type(screen.getByLabelText('Mobile No. or Email'), 'target@example.com')
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'AnyPassword123!')
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/Too many sign-in attempts/i)
  })

  it('displays network failure error when server is unreachable', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValue(
      new ApiError({
        status: 0,
        code: 'NETWORK_ERROR',
        message: 'Unable to reach the server. Check your connection and try again.',
      }),
    )

    renderAt(<LoginForm />)

    await userEvent.type(screen.getByLabelText('Mobile No. or Email'), 'offline@example.com')
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'AnyPassword123!')
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/Unable to reach the server/i)
  })

  it('validates required fields before firing API request', async () => {
    const spy = vi.spyOn(authApi, 'login')

    renderAt(<LoginForm />)

    // Submit with empty fields
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(spy).not.toHaveBeenCalled()
    expect(screen.getByText('Enter your mobile number or email.')).toBeTruthy()
    expect(screen.getByText('Enter your password.')).toBeTruthy()
  })

  it('password toggle flips input type between password and text', async () => {
    renderAt(<LoginForm />)
    const toggle = screen.getByRole('button', { name: 'Show password' })
    const pw = screen.getByLabelText('Password', { exact: true })

    expect(pw.getAttribute('type')).toBe('password')
    await userEvent.click(toggle)
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(pw.getAttribute('type')).toBe('text')

    await userEvent.click(toggle)
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(pw.getAttribute('type')).toBe('password')
  })

  it('navigates to forgot-password page via link', async () => {
    renderAt(<LoginForm />)
    const forgotLink = screen.getByRole('link', { name: 'Forgot Password?' })
    expect(forgotLink.getAttribute('href')).toBe('/forgot-password')
    await userEvent.click(forgotLink)
    expect(await screen.findByRole('heading', { name: 'Forgot Password Page' })).toBeTruthy()
  })

  it('executes Google SSO on Login page and navigates to /memory-wall', async () => {
    let googleCallback: ((res: { credential?: string }) => void) | undefined
    window.google = {
      accounts: {
        id: {
          initialize: vi.fn((config) => {
            googleCallback = config.callback
          }),
          renderButton: vi.fn(),
          prompt: vi.fn(() => {
            if (googleCallback) {
              googleCallback({ credential: 'valid-login-google-token' })
            }
          }),
          cancel: vi.fn(),
        },
      },
    }

    const spy = vi.spyOn(authApi, 'loginWithGoogle').mockResolvedValue(mockGoogleSuccessResponse)
    const tokenSaveSpy = vi.spyOn(tokenStorage, 'save')

    renderAt(<LoginForm />)
    await userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({ id_token: 'valid-login-google-token' })
    })

    expect(tokenSaveSpy).toHaveBeenCalledWith(mockGoogleSuccessResponse.tokens)
    expect(await screen.findByRole('heading', { name: 'Planner' })).toBeTruthy()

    delete (window as { google?: unknown }).google
  })

  it('displays error alert when Google SSO token verification fails on Login', async () => {
    let googleCallback: ((res: { credential?: string }) => void) | undefined
    window.google = {
      accounts: {
        id: {
          initialize: vi.fn((config) => {
            googleCallback = config.callback
          }),
          renderButton: vi.fn(),
          prompt: vi.fn(() => {
            if (googleCallback) {
              googleCallback({ credential: 'invalid-google-token' })
            }
          }),
          cancel: vi.fn(),
        },
      },
    }

    vi.spyOn(authApi, 'loginWithGoogle').mockRejectedValue(
      new ApiError({
        status: 401,
        code: 'INVALID_GOOGLE_TOKEN',
        message: 'Google authentication token could not be verified.',
      }),
    )

    renderAt(<LoginForm />)
    await userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/Google authentication token could not be verified/i)

    delete (window as { google?: unknown }).google
  })

  it('displays disabled account error on Google SSO 403', async () => {
    let googleCallback: ((res: { credential?: string }) => void) | undefined
    window.google = {
      accounts: {
        id: {
          initialize: vi.fn((config) => {
            googleCallback = config.callback
          }),
          renderButton: vi.fn(),
          prompt: vi.fn(() => {
            if (googleCallback) {
              googleCallback({ credential: 'token-disabled-user' })
            }
          }),
          cancel: vi.fn(),
        },
      },
    }

    vi.spyOn(authApi, 'loginWithGoogle').mockRejectedValue(
      new ApiError({
        status: 403,
        code: 'ACCOUNT_DISABLED',
        message: 'Account disabled',
      }),
    )

    renderAt(<LoginForm />)
    await userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/This account has been deactivated/i)

    delete (window as { google?: unknown }).google
  })
})
