import axios, { type AxiosError, type AxiosResponse } from 'axios'
import toast from 'react-hot-toast'
import { getToken, clearSession } from '@/utils/session'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3001'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.set('x-auth-token', token)
  }
  return config
})

interface Envelope<T> {
  status: boolean
  message: string
  code: string
  data: T
}

// The backend uses two conventions inconsistently: some controllers wrap success
// payloads in {status,message,code,data} (auth, admin, reservations, favourites, cms),
// others return the raw entity/array (books, authors, loans, analytics). This detects
// the envelope shape and unwraps it so every api/*.ts module can just return T.
function isEnvelope<T>(payload: unknown): payload is Envelope<T> {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'status' in payload &&
    'message' in payload &&
    'code' in payload &&
    'data' in payload &&
    typeof (payload as Record<string, unknown>).status === 'boolean'
  )
}

apiClient.interceptors.response.use((response: AxiosResponse) => {
  if (isEnvelope(response.data)) {
    response.data = response.data.data
  }
  return response
})

export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<Partial<Envelope<unknown>> & { message?: string }>
    const data = axiosError.response?.data
    if (data?.message) return data.message
    if (Array.isArray((data as { data?: unknown })?.data)) {
      const validationErrors = (data as { data: Array<{ message?: string }> }).data
      const first = validationErrors[0]?.message
      if (first) return first
    }
    if (axiosError.message) return axiosError.message
  }
  if (error instanceof Error) return error.message
  return fallback
}

export function isUnauthorized(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401
}

// Access tokens expire after 15 minutes (backend JWT_EXPIRY, hardcoded, no refresh
// endpoint is wired up server-side — see api/auth.api.ts). Once one request 401s,
// clearing the token alone isn't enough: every other in-flight/queued request (e.g.
// the analytics page's several parallel fetches) will also 401 immediately after,
// producing a flood of console errors while the page sits there doing nothing. Force
// a full redirect to /login the first time this happens per page load so the app
// state resets cleanly instead of limping along with a cleared token.
let hasHandledExpiry = false

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      const hadSession = Boolean(getToken())
      clearSession()
      const onAuthPage = ['/login', '/register', '/user-email-verification'].some((path) =>
        window.location.pathname.startsWith(path),
      )
      if (hadSession && !onAuthPage && !hasHandledExpiry) {
        hasHandledExpiry = true
        toast.error('Your session has expired. Please sign in again.')
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)
