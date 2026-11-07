import type {
  AuthTokens,
  GoogleAuthRequest,
  GoogleAuthResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  User,
} from '@/types/api'
import { api } from './apiClient'
import { endpoints } from './endpoints'

/**
 * Registers a new customer account via POST /api/v1/auth/register.
 *
 * @param request Validated registration payload (full_name, email, E.164 phone, password).
 * @param signal Optional AbortSignal for in-flight request cancellation.
 * @returns User profile and JWT access/refresh token pair.
 */
export async function register(
  request: RegisterRequest,
  signal?: AbortSignal,
): Promise<RegisterResponse> {
  return api.post<RegisterResponse>(endpoints.auth.register, request, { signal })
}

/**
 * Authenticates an existing customer via POST /api/v1/auth/login.
 *
 * @param request Validated login payload (email or Indian phone + password).
 * @param signal Optional AbortSignal for in-flight request cancellation.
 * @returns User profile and JWT access/refresh token pair.
 */
export async function login(
  request: LoginRequest,
  signal?: AbortSignal,
): Promise<LoginResponse> {
  return api.post<LoginResponse>(endpoints.auth.login, request, { signal })
}

/**
 * Authenticates or registers a user via Google OpenID Connect ID token via POST /api/v1/auth/google.
 *
 * @param request Validated Google payload containing the Google issued ID token.
 * @param signal Optional AbortSignal for in-flight request cancellation.
 * @returns User profile and JWT access/refresh token pair.
 */
export async function loginWithGoogle(
  request: GoogleAuthRequest,
  signal?: AbortSignal,
): Promise<GoogleAuthResponse> {
  return api.post<GoogleAuthResponse>(endpoints.auth.google, request, { signal })
}

/**
 * Rotates the refresh token and issues a new access token via POST /api/v1/auth/refresh.
 * Relies on the secure httpOnly cookie (or optional explicit body).
 *
 * @param body Optional refresh token if not relying exclusively on httpOnly cookie.
 * @param signal Optional AbortSignal for in-flight request cancellation.
 * @returns New access and refresh token pair.
 */
export async function refreshTokens(
  body?: { refresh_token?: string },
  signal?: AbortSignal,
): Promise<AuthTokens> {
  return api.post<AuthTokens>(endpoints.auth.refresh, body ?? {}, { signal, auth: false })
}

/**
 * Revokes the active session and clears the refresh cookie via POST /api/v1/auth/logout.
 *
 * @param signal Optional AbortSignal for in-flight request cancellation.
 */
export async function logout(signal?: AbortSignal): Promise<void> {
  return api.post<void>(endpoints.auth.logout, {}, { signal, auth: false })
}

/**
 * Retrieves the currently authenticated user's profile via GET /api/v1/auth/me.
 *
 * @param signal Optional AbortSignal for in-flight request cancellation.
 * @returns Current user profile.
 */
export async function getMe(signal?: AbortSignal): Promise<User> {
  return api.get<User>(endpoints.auth.me, { signal })
}

