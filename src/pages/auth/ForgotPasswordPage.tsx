import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { getErrorMessage } from '@/api/client'
import * as authApi from '@/api/auth.api'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Public page for requesting a password reset email. Shows the same "check your
// email" confirmation regardless of whether the address is registered, since the
// API deliberately doesn't reveal that either.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Email is required')
      return
    }
    if (!EMAIL_RE.test(trimmed)) {
      setError('Enter a valid email address')
      return
    }
    setError(undefined)
    setIsLoading(true)
    try {
      await authApi.forgotPassword(trimmed)
      // Always show the same success state, whether or not the email is registered —
      // the backend deliberately gives no signal either way.
      setIsSent(true)
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to send the reset email. Please try again.'))
    } finally {
      setIsLoading(false)
    }
  }

  if (isSent) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100">
          <MailCheck className="size-6 text-emerald-600" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Check your email</h2>
        <p className="text-sm text-slate-500">
          If an account exists for <span className="font-medium text-slate-700">{email.trim()}</span>, a password
          reset link is on its way. The link expires in 30 minutes.
        </p>
        <Link to="/login" className="mt-2 text-sm font-medium text-brand-600 hover:text-brand-700">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Forgot your password?</h2>
      <p className="mt-1 text-sm text-slate-500">
        Enter the email on your account and we'll send you a link to reset your password.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          error={error}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
          Send reset link
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Remembered it?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
