import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import * as authApi from '@/api/auth.api'
import { setSession } from '@/utils/session'
import { getErrorMessage } from '@/api/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface LocationState {
  email?: string
}

// Public page shown right after registration. The user enters the 6-digit code
// emailed to them; submitting it successfully is the actual moment they become
// logged in (the session token is issued here, not at register time).
export default function VerifyOtpPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const stateEmail = (location.state as LocationState | null)?.email ?? ''

  const [email, setEmail] = useState(stateEmail)
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError('Enter the email you registered with.')
      return
    }
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Enter the 6-digit code from your email.')
      return
    }

    setIsVerifying(true)
    try {
      const result = await authApi.verifyRegistrationOtp(email.trim(), otp.trim())
      // This is where the session actually begins: tokens are issued on OTP
      // verification, not at registration.
      setSession(result.token)
      toast.success('Email verified! Redirecting…')
      // Full reload so AuthContext re-initializes from the freshly-set token,
      // same pattern the old link-based verification page used.
      window.location.assign('/')
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to verify this code.'))
    } finally {
      setIsVerifying(false)
    }
  }

  async function handleResend() {
    if (!email.trim()) {
      setError('Enter the email you registered with first.')
      return
    }

    setIsResending(true)
    try {
      await authApi.resendRegistrationOtp(email.trim())
      toast.success('If that email needs verifying, a new code has been sent.')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to resend the code.'))
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Verify your email</h1>
      <p className="mb-6 text-sm text-slate-500">
        Enter the 6-digit code we emailed you to activate your account.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Verification code"
          inputMode="numeric"
          maxLength={6}
          placeholder="123456"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="text-center text-lg tracking-[0.5em]"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" isLoading={isVerifying} className="w-full">
          Verify
        </Button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={handleResend}
          disabled={isResending}
          className="font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
        >
          {isResending ? 'Sending…' : 'Resend code'}
        </button>
        <Link to="/login" className="font-medium text-slate-500 hover:text-slate-700">
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
