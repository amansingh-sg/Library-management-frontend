import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { getErrorMessage } from '@/api/client'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface FormState {
  email: string
  password: string
  firstName: string
  lastName: string
  dob: string
  marketing: boolean
}

const initialState: FormState = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  dob: '',
  marketing: false,
}

type FieldErrors = Partial<Record<keyof Omit<FormState, 'marketing'>, string>>

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState<FormState>(initialState)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [isLoading, setIsLoading] = useState(false)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function validate(): boolean {
    const next: FieldErrors = {}
    if (!form.firstName.trim()) next.firstName = 'First name is required'
    if (!form.lastName.trim()) next.lastName = 'Last name is required'
    if (!form.email.trim()) next.email = 'Email is required'
    else if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address'
    if (!form.password) next.password = 'Password is required'
    else if (form.password.length < 8) next.password = 'Password must be at least 8 characters'
    if (!form.dob) next.dob = 'Date of birth is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!validate()) return

    setIsLoading(true)
    try {
      await register({
        email: form.email.trim(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        dob: form.dob,
        marketing: form.marketing,
      })
      toast.success('Account created! Check your email for a 6-digit code to verify.', {
        duration: 6000,
      })
      navigate('/verify-otp', { replace: true, state: { email: form.email.trim() } })
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to create your account. Please try again.'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Create an account</h2>
      <p className="mt-1 text-sm text-slate-500">Join the library to start borrowing books.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First name"
            name="firstName"
            autoComplete="given-name"
            value={form.firstName}
            error={errors.firstName}
            onChange={(e) => update('firstName', e.target.value)}
          />
          <Input
            label="Last name"
            name="lastName"
            autoComplete="family-name"
            value={form.lastName}
            error={errors.lastName}
            onChange={(e) => update('lastName', e.target.value)}
          />
        </div>
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={form.email}
          error={errors.email}
          onChange={(e) => update('email', e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={form.password}
          error={errors.password}
          onChange={(e) => update('password', e.target.value)}
        />
        <Input
          label="Date of birth"
          type="date"
          name="dob"
          value={form.dob}
          error={errors.dob}
          onChange={(e) => update('dob', e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={form.marketing}
            onChange={(e) => update('marketing', e.target.checked)}
            className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/40"
          />
          Send me library news and updates
        </label>
        <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </div>
  )
}
