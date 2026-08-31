import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import * as authApi from '@/api/auth.api'
import { setSession } from '@/utils/session'
import { getErrorMessage } from '@/api/client'
import { ErrorState } from '@/components/ui/ErrorState'
import { Button } from '@/components/ui/Button'

type Status = 'pending' | 'success' | 'error'

export default function VerifyEmailPage() {
  const { uniqueKey } = useParams<{ uniqueKey: string }>()
  const [status, setStatus] = useState<Status>('pending')
  const [message, setMessage] = useState('')
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    if (!uniqueKey) {
      setStatus('error')
      setMessage('This verification link is invalid.')
      return
    }

    authApi
      .verifyEmail(uniqueKey)
      .then((result) => {
        setSession(result.token)
        setStatus('success')
      })
      .catch((error) => {
        setStatus('error')
        setMessage(getErrorMessage(error, 'This verification link is invalid or has expired.'))
      })
  }, [uniqueKey])

  if (status === 'pending') {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="size-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
        <p className="text-sm text-slate-500">Verifying your email…</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div>
        <ErrorState message={message} />
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Back to sign in
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 className="size-6 text-emerald-600" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900">Email verified</h2>
      <p className="text-sm text-slate-500">Your account is confirmed. You're signed in and ready to go.</p>
      <Button className="mt-2 w-full" onClick={() => window.location.assign('/')}>
        Go to dashboard
      </Button>
    </div>
  )
}
