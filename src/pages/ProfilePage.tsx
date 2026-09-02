import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { KeyRound, ShieldCheck, User as UserIcon } from 'lucide-react'
import { getMyProfile, changeMyPassword } from '@/api/auth.api'
import { getErrorMessage } from '@/api/client'
import { PageHeader } from '@/components/member/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import type { AdminUser } from '@/types/models'

const EMPTY_PASSWORD_FORM = { currentPassword: '', newPassword: '', confirmPassword: '' }

export default function ProfilePage() {
  const [profile, setProfile] = useState<AdminUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  function load() {
    setIsLoading(true)
    setError(null)
    getMyProfile()
      .then(setProfile)
      .catch((err) => setError(getErrorMessage(err, 'Unable to load your profile.')))
      .finally(() => setIsLoading(false))
  }

  useEffect(load, [])

  async function handleChangePassword() {
    setPasswordError(null)

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('All fields are required.')
      return
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }

    setIsSavingPassword(true)
    try {
      await changeMyPassword(passwordForm.currentPassword, passwordForm.newPassword)
      toast.success('Password updated.')
      setPasswordForm(EMPTY_PASSWORD_FORM)
    } catch (err) {
      setPasswordError(getErrorMessage(err, 'Unable to update your password.'))
    } finally {
      setIsSavingPassword(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Profile" description="Your account details and security settings." />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div>
        <PageHeader title="Profile" />
        <ErrorState message={error ?? 'Unable to load your profile.'} onRetry={load} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Profile" description="Your account details and security settings." />

      <Card>
        <CardHeader className="flex items-center gap-2">
          <UserIcon className="size-4 text-slate-400" />
          <CardTitle>Account details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">Name</p>
              <p className="text-sm font-medium text-slate-900">
                {profile.firstName} {profile.lastName}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Email</p>
              <p className="text-sm font-medium text-slate-900">{profile.email}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Date of birth</p>
              <p className="text-sm font-medium text-slate-900">{profile.dob || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Role</p>
              <p className="text-sm font-medium text-slate-900">{profile.role}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-slate-500">Email status</p>
              <Badge tone={profile.isVerified ? 'green' : 'amber'}>
                {profile.isVerified ? 'Verified' : 'Unverified'}
              </Badge>
            </div>
            <div>
              <p className="mb-1 text-xs text-slate-500">Account status</p>
              <Badge tone={profile.isActive ? 'green' : 'red'}>{profile.isActive ? 'Active' : 'Deactivated'}</Badge>
            </div>
          </div>
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            Name, email, and date of birth can't be changed here — contact a librarian or admin if any of these
            need correcting.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center gap-2">
          <KeyRound className="size-4 text-slate-400" />
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex max-w-sm flex-col gap-4">
            <Input
              label="Current password"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
            />
            <Input
              label="New password"
              type="password"
              hint="At least 8 characters."
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
            />
            <Input
              label="Confirm new password"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))}
            />
            {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
            <div>
              <Button onClick={handleChangePassword} isLoading={isSavingPassword}>
                <ShieldCheck className="size-4" />
                Update password
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
