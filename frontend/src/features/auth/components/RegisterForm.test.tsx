// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as authApi from '@/services/authApi'
import { ApiError } from '@/services/apiClient'
import { tokenStorage } from '@/services/tokenStorage'
import type { RegisterResponse } from '@/types/api'
import { RegisterForm } from './RegisterForm'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const mockRegisterSuccessResponse: RegisterResponse = {
  user: {
    id: '672cf1a9e4b0123456789abc',
    email: 'aarav@example.com',
    full_name: 'Aarav Sharma',
    phone: '+919876543210',
    role: 'customer',
    is_active: true,
    created_at: '2026-11-07T12:00:00.000Z',
  },
  tokens: {
    access_token: 'test-jwt-access-token',
    refresh_token: 'test-secure-refresh-token',
    token_type: 'bearer',
    expires_in: 1800,
  },
}

function renderAt(element: ReactNode) {
  const router = createMemoryRouter(
    [
      { path: '/', element },
      { path: '/memory-wall', element: <h1>Planner</h1> },
      { path: '/forgot-password', element: <h1>Forgot</h1> },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('RegisterForm', () => {
  it('labels every field (incl. the +91 country code for screen readers)', () => {
    renderAt(<RegisterForm />)
    for (const name of ['Full Name', 'Email Address', 'Mobile Number, country code +91', 'Password']) {
      expect(screen.getByLabelText(name)).toBeTruthy()
    }
    const pw = screen.getByLabelText('Password', { exact: true })
    expect(pw.getAttribute('aria-describedby')).toBeTruthy()
    expect(document.getElementById(pw.getAttribute('aria-describedby') ?? '')?.textContent).toMatch(
      /at least 8/,
    )
  })

  it('sends a normalised payload, persists session tokens, and navigates on success', async () => {
    const registerSpy = vi.spyOn(authApi, 'register').mockResolvedValue(mockRegisterSuccessResponse)
    const tokenStorageSpy = vi.spyOn(tokenStorage, 'save')
    const router = renderAt(<RegisterForm />)

    await userEvent.type(screen.getByLabelText('Full Name'), '  Aarav   Sharma ')
    await userEvent.type(screen.getByLabelText('Email Address'), 'Aarav@Example.com')
    await userEvent.type(screen.getByLabelText(/Mobile Number/), '98765 43210')
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'SecurePass123')
    await userEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    expect(registerSpy).toHaveBeenCalledWith(
      {
        full_name: 'Aarav Sharma',
        email: 'aarav@example.com',
        phone: '+919876543210',
        password: 'SecurePass123',
      },
      expect.any(AbortSignal),
    )
    expect(tokenStorageSpy).toHaveBeenCalledWith(mockRegisterSuccessResponse.tokens)
    expect(await screen.findByRole('heading', { name: 'Planner' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/memory-wall')
  })

  it('blocks invalid input without calling the API', async () => {
    const registerSpy = vi.spyOn(authApi, 'register')
    renderAt(<RegisterForm />)
    await userEvent.type(screen.getByLabelText('Email Address'), '"><script>@x.com')
    await userEvent.click(screen.getByRole('button', { name: 'Create Account' }))
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy()
    expect(registerSpy).not.toHaveBeenCalled()
  })

  it('renders inline server field error when duplicate email conflict (409) occurs', async () => {
    const conflictError = new ApiError({
      status: 409,
      code: 'ACCOUNT_ALREADY_EXISTS',
      message: 'Email or phone already exists',
      details: [{ field: 'email', issue: 'Email is already registered' }],
    })
    vi.spyOn(authApi, 'register').mockRejectedValue(conflictError)

    renderAt(<RegisterForm />)
    await userEvent.type(screen.getByLabelText('Full Name'), 'Aarav Sharma')
    await userEvent.type(screen.getByLabelText('Email Address'), 'duplicate@example.com')
    await userEvent.type(screen.getByLabelText(/Mobile Number/), '9876543210')
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'Password123!')
    await userEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    expect(await screen.findByText('Email is already registered')).toBeTruthy()
  })

  it('renders inline server field error when duplicate phone conflict (409) occurs', async () => {
    const conflictError = new ApiError({
      status: 409,
      code: 'ACCOUNT_ALREADY_EXISTS',
      message: 'Email or phone already exists',
      details: [{ field: 'phone', issue: 'Mobile number is already registered' }],
    })
    vi.spyOn(authApi, 'register').mockRejectedValue(conflictError)

    renderAt(<RegisterForm />)
    await userEvent.type(screen.getByLabelText('Full Name'), 'Aarav Sharma')
    await userEvent.type(screen.getByLabelText('Email Address'), 'new@example.com')
    await userEvent.type(screen.getByLabelText(/Mobile Number/), '9876543210')
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'Password123!')
    await userEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    expect(await screen.findByText('Mobile number is already registered')).toBeTruthy()
  })

  it('renders form-level error on rate limit exceeded (429)', async () => {
    const rateLimitError = new ApiError({
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many registration attempts. Please try again later.',
    })
    vi.spyOn(authApi, 'register').mockRejectedValue(rateLimitError)

    renderAt(<RegisterForm />)
    await userEvent.type(screen.getByLabelText('Full Name'), 'Aarav Sharma')
    await userEvent.type(screen.getByLabelText('Email Address'), 'test@example.com')
    await userEvent.type(screen.getByLabelText(/Mobile Number/), '9876543210')
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'Password123!')
    await userEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    expect(await screen.findByText(/Too many attempts\. Please wait a minute and try again\./)).toBeTruthy()
  })

  it('renders network error message when connection fails', async () => {
    const networkError = new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Unable to reach the server. Check your connection and try again.',
    })
    vi.spyOn(authApi, 'register').mockRejectedValue(networkError)

    renderAt(<RegisterForm />)
    await userEvent.type(screen.getByLabelText('Full Name'), 'Aarav Sharma')
    await userEvent.type(screen.getByLabelText('Email Address'), 'test@example.com')
    await userEvent.type(screen.getByLabelText(/Mobile Number/), '9876543210')
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'Password123!')
    await userEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    expect(await screen.findByText(/Unable to reach the server/)).toBeTruthy()
  })

  it('shows submitting state and disables submission while in-flight', async () => {
    let resolveRegistration: (val: RegisterResponse) => void = () => {}
    const pendingPromise = new Promise<RegisterResponse>((resolve) => {
      resolveRegistration = resolve
    })
    vi.spyOn(authApi, 'register').mockImplementation(() => pendingPromise)

    renderAt(<RegisterForm />)
    await userEvent.type(screen.getByLabelText('Full Name'), 'Aarav Sharma')
    await userEvent.type(screen.getByLabelText('Email Address'), 'test@example.com')
    await userEvent.type(screen.getByLabelText(/Mobile Number/), '9876543210')
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'Password123!')

    const submitBtn = screen.getByRole('button', { name: 'Create Account' })
    await userEvent.click(submitBtn)

    // Button should be in loading state and disabled
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Creating account…/i })).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: /Creating account…/i }).getAttribute('aria-busy')).toBe('true')

    // Resolve the registration
    resolveRegistration(mockRegisterSuccessResponse)
    expect(await screen.findByRole('heading', { name: 'Planner' })).toBeTruthy()
  })

  it('registers successfully with Google and navigates to planner', async () => {
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
              googleCallback({ credential: 'valid-google-id-token' })
            }
          }),
          cancel: vi.fn(),
        },
      },
    }

    const spy = vi.spyOn(authApi, 'loginWithGoogle').mockResolvedValue(mockRegisterSuccessResponse)
    const tokenSaveSpy = vi.spyOn(tokenStorage, 'save')

    renderAt(<RegisterForm />)
    await userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({ id_token: 'valid-google-id-token' })
    })
    expect(tokenSaveSpy).toHaveBeenCalledWith(mockRegisterSuccessResponse.tokens)
    expect(await screen.findByRole('heading', { name: 'Planner' })).toBeTruthy()

    delete (window as { google?: unknown }).google
  })

  it('displays error alert when Google registration fails', async () => {
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
              googleCallback({ credential: 'forged-or-expired-token' })
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

    renderAt(<RegisterForm />)
    await userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/Google authentication token could not be verified/i)

    delete (window as { google?: unknown }).google
  })
})
