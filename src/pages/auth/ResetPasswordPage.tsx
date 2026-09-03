import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { CheckCircle2 } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { getErrorMessage } from '@/api/client'
import * as authApi from '@/api/auth.api'

// Public page reached from the password-reset email link (`/reset-password/:token`).
// Lets the user set a new password using the token in the URL; shows an error state
// if the token is missing entirely.
export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isDone, setIsDone] = useState(false)

  if (!token) {
    return (
      <div>
        <ErrorState message="This password reset link is invalid." />
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/forgot-password" className="font-medium text-brand-600 hover:text-brand-700">
            Request a new link
          </Link>
        </p>
      </div>
    )
  }

  function validate(): boolean {
    const next: { password?: string; confirmPassword?: string } = {}
    if (!password) next.password = 'Password is required'
    else if (password.length < 8) next.password = 'Password must be at least 8 characters'
    if (confirmPassword !== password) next.confirmPassword = "Passwords don't match"
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!validate()) return

    setIsLoading(true)
    try {
      await authApi.resetPassword(token as string, password)
      setIsDone(true)
      toast.success('Password reset. Please sign in.')
    } catch (err) {
      toast.error(getErrorMessage(err, 'This reset link is invalid or has expired.'))
    } finally {
      setIsLoading(false)
    }
  }

  if (isDone) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="size-6 text-emerald-600" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Password reset</h2>
        <p className="text-sm text-slate-500">Your password has been updated. Sign in with your new password.</p>
        <Button className="mt-2 w-full" onClick={() => navigate('/login', { replace: true })}>
          Go to sign in
        </Button>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Set a new password</h2>
      <p className="mt-1 text-sm text-slate-500">Choose a new password for your account.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
        <Input
          label="New password"
          type="password"
          name="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          error={errors.password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          label="Confirm new password"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirmPassword}
          error={errors.confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
          Reset password
        </Button>
      </form>
    </div>
  )
}
