import type {
  GoogleAuthRequest,
  GoogleAuthResponse,
  RegisterRequest,
  RegisterResponse,
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

