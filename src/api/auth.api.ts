import { apiClient } from './client'
import type { AuthSession, LoginPayload, RegisterPayload } from '@/types/models'

// POST /register -> 201 { id, email, token } (base.route.ts, no /api prefix)
export async function register(payload: RegisterPayload): Promise<AuthSession> {
  const { data } = await apiClient.post<AuthSession>('/register', payload)
  return data
}

// POST /login -> 200 { id, email, token, refreshToken }. Rate-limited 5 req/15min.
export async function login(payload: LoginPayload): Promise<AuthSession> {
  const { data } = await apiClient.post<AuthSession>('/login', payload)
  return data
}

// GET /user-email-verification/:uniqueKey -> { id, email, token, message }
export async function verifyEmail(uniqueKey: string): Promise<AuthSession & { message: string }> {
  const { data } = await apiClient.get<AuthSession & { message: string }>(
    `/user-email-verification/${encodeURIComponent(uniqueKey)}`,
  )
  return data
}

// POST /forgot-password -> 200, always the same response whether or not the email is
// registered (avoids leaking which emails have accounts). Rate-limited 10 req/15min.
export async function forgotPassword(email: string): Promise<void> {
  await apiClient.post('/forgot-password', { email })
}

// POST /reset-password -> 200. Token is single-use and expires 30 minutes after
// request. Rate-limited 10 req/15min.
export async function resetPassword(token: string, password: string): Promise<void> {
  await apiClient.post('/reset-password', { token, password })
}
