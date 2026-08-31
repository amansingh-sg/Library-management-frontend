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
