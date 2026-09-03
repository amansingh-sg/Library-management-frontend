import { apiClient } from './client'
import type { AdminUser, AuthSession, LoginPayload, RegisterPayload, RegisteredAccount } from '@/types/models'

// POST /register -> 201 { id, email } (base.route.ts, no /api prefix). No token - the
// account isn't verified yet, so it can't log in until the OTP emailed to it is
// confirmed via verifyRegistrationOtp below.
export async function register(payload: RegisterPayload): Promise<RegisteredAccount> {
  const { data } = await apiClient.post<RegisteredAccount>('/register', payload)
  return data
}

// POST /login -> 200 { id, email, token, refreshToken }. Rate-limited 5 req/15min.
export async function login(payload: LoginPayload): Promise<AuthSession> {
  const { data } = await apiClient.post<AuthSession>('/login', payload)
  return data
}

// POST /refresh-token -> 200 { token }. Exchanges the long-lived refresh token
// (issued at login, valid 7 days) for a new 15-minute access token, so the user
// doesn't get bounced to /login every time the access token expires.
export async function refreshAccessToken(refreshToken: string): Promise<{ token: string }> {
  const { data } = await apiClient.post<{ token: string }>('/refresh-token', { refreshToken })
  return data
}

// POST /verify-registration-otp -> 200 { id, email, token, message }. The 6-digit
// code emailed at registration - rate-limited 10 req/15min (brute-force guard).
export async function verifyRegistrationOtp(
  email: string,
  otp: string,
): Promise<AuthSession & { message: string }> {
  const { data } = await apiClient.post<AuthSession & { message: string }>('/verify-registration-otp', {
    email,
    otp,
  })
  return data
}

// POST /resend-registration-otp -> 200, always the same response whether or not the
// email is registered/already verified. Rate-limited 10 req/15min.
export async function resendRegistrationOtp(email: string): Promise<void> {
  await apiClient.post('/resend-registration-otp', { email })
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

// GET /users/me -> 200, the logged-in user's own profile - same shape as AdminUser
// (never includes the password hash). Any authenticated user, any role.
export async function getMyProfile(): Promise<AdminUser> {
  const { data } = await apiClient.get<AdminUser>('/users/me')
  return data
}

// PATCH /users/me/password -> 200. Requires the current password (this is the
// logged-in "change my password" flow, distinct from the forgot-password token
// flow above) - 400s with "Incorrect Password" if currentPassword is wrong.
export async function changeMyPassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.patch('/users/me/password', { currentPassword, newPassword })
}
