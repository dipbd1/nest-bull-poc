import type {
  AuthPublicConfig,
  AuthTokenResponse,
  AuthUser,
  RegisterResponse,
} from '../domain/types.ts'
import { apiUrl, request } from './client.ts'

export function getAuthConfig() {
  return request<AuthPublicConfig>('/auth/config', { anonymous: true })
}

export function register(email: string, password: string) {
  return request<RegisterResponse>('/auth/register', {
    method: 'POST',
    anonymous: true,
    body: JSON.stringify({ email, password }),
  })
}

export function verifyRegistration(email: string, code: string) {
  return request<AuthTokenResponse>('/auth/register/verify', {
    method: 'POST',
    anonymous: true,
    body: JSON.stringify({ email, code }),
  })
}

export function login(email: string, password: string) {
  return request<AuthTokenResponse>('/auth/login', {
    method: 'POST',
    anonymous: true,
    body: JSON.stringify({ email, password }),
  })
}

/** The server answers 204 and clears the cookie. */
export function logout() {
  return request<void>('/auth/logout', { method: 'POST', anonymous: true })
}

/** Full-page navigation: the server redirects to the identity provider. */
export function companyLoginUrl() {
  return apiUrl('/auth/oidc/start')
}

export function getMe() {
  return request<AuthUser>('/auth/me')
}
