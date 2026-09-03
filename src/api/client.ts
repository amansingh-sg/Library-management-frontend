import axios, { type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import toast from 'react-hot-toast'
import { getToken, getRefreshToken, setSession, clearSession } from '@/utils/session'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3001'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attaches the stored access token to every outgoing request, so individual
// api/*.ts calls never have to remember to add auth headers themselves.
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

// Unwraps the envelope (when present) here, once, so every function in api/*.ts
// can just do `const { data } = await apiClient.get(...)` and get the real payload
// straight away, regardless of which convention the endpoint it called happens to use.
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
    // Validation errors (Joi, via HttpRequestValidator) always carry the generic string
    // "Validation Error" as the top-level `message` — the actually useful, field-specific
    // text ("password must be 8 characters long") is in `data` (an array of
    // {message,label}). Must check this FIRST: checking data.message first (as this used
    // to) always wins since it's always truthy, so the specific message was dead code —
    // every validation failure on the site showed the same unhelpful "Validation Error"
    // toast regardless of what actually went wrong.
    if (Array.isArray((data as { data?: unknown })?.data)) {
      const validationErrors = (data as { data: Array<{ message?: string }> }).data
      const first = validationErrors[0]?.message
      if (first) return first
    }
    if (data?.message) return data.message
    if (axiosError.message) return axiosError.message
  }
  if (error instanceof Error) return error.message
  return fallback
}

export function isUnauthorized(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401
}

// Access tokens expire after 15 minutes (backend JWT_EXPIRY). Rather than forcing a
// full logout every time one expires, exchange the refresh token (issued at login,
// valid 7 days - see POST /refresh-token) for a new access token and transparently
// retry the request that 401'd. Concurrent 401s (e.g. the analytics page's several
// parallel fetches) share a single in-flight refresh instead of each firing their own.
let refreshPromise: Promise<string> | null = null

async function performRefresh(): Promise<string> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) throw new Error('No refresh token available')
  // Plain axios, not apiClient - this must not go through the interceptor below,
  // or a 401 here (expired/invalid refresh token) would recurse into itself.
  const { data } = await axios.post<{ data: { token: string } }>(`${API_BASE_URL}/refresh-token`, {
    refreshToken,
  })
  const newToken = data.data.token
  setSession(newToken)
  return newToken
}

let hasHandledExpiry = false

function forceLogout() {
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

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as (InternalAxiosRequestConfig & { _retriedAfterRefresh?: boolean }) | undefined
    const isRefreshCall = config?.url?.includes('/refresh-token')

    if (error.response?.status === 401 && config && !config._retriedAfterRefresh && !isRefreshCall && getRefreshToken()) {
      config._retriedAfterRefresh = true
      try {
        refreshPromise ??= performRefresh().finally(() => {
          refreshPromise = null
        })
        const newToken = await refreshPromise
        config.headers.set('x-auth-token', newToken)
        return apiClient(config)
      } catch {
        forceLogout()
        return Promise.reject(error)
      }
    }

    if (error.response?.status === 401) {
      forceLogout()
    }
    return Promise.reject(error)
  },
)
