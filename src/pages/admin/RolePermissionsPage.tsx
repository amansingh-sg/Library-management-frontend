import { Fragment, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Check, Lock, ShieldCheck } from 'lucide-react'
import * as adminApi from '@/api/admin.api'
import { getErrorMessage } from '@/api/client'
import { Permission, Role } from '@/types/enums'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { cn } from '@/utils/cn'

interface PermissionGroup {
  label: string
  permissions: Permission[]
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  { label: 'Books', permissions: [Permission.VIEW_BOOKS, Permission.MANAGE_BOOKS] },
  {
    label: 'Loans',
    permissions: [
      Permission.BORROW_BOOKS,
      Permission.VIEW_OWN_LOANS,
      Permission.ISSUE_LOANS,
      Permission.RETURN_LOANS,
      Permission.RENEW_LOANS,
      Permission.MANAGE_LOANS,
    ],
  },
  {
    label: 'Reservations',
    permissions: [Permission.CREATE_RESERVATION, Permission.VIEW_OWN_RESERVATIONS, Permission.MANAGE_RESERVATIONS],
  },
  { label: 'Members & Users', permissions: [Permission.MANAGE_MEMBERS, Permission.MANAGE_USERS] },
  { label: 'System', permissions: [Permission.MANAGE_ROLE_PERMISSIONS, Permission.FULL_SYSTEM_ACCESS] },
]

const ROLES = Object.values(Role)

function grantKey(role: Role, permission: Permission): string {
  return `${role}:${permission}`
}

export default function RolePermissionsPage() {
  const [grantedKeys, setGrantedKeys] = useState<Set<string>>(new Set())
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadGrants() {
    setIsLoading(true)
    setError(null)
    try {
      const grants = await adminApi.getAllRolePermissions()
      setGrantedKeys(new Set(grants.map((grant) => grantKey(grant.role, grant.permission))))
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load role permissions.'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadGrants()
  }, [])

  const isGranted = useMemo(
    () => (role: Role, permission: Permission) =>
      role === Role.SUPER_ADMIN || grantedKeys.has(grantKey(role, permission)),
    [grantedKeys],
  )

  async function toggle(role: Role, permission: Permission) {
    if (role === Role.SUPER_ADMIN) return
    const key = grantKey(role, permission)
    if (pendingKeys.has(key)) return

    const wasGranted = grantedKeys.has(key)
    setGrantedKeys((prev) => {
      const next = new Set(prev)
      if (wasGranted) next.delete(key)
      else next.add(key)
      return next
    })
    setPendingKeys((prev) => new Set(prev).add(key))

    try {
      if (wasGranted) {
        await adminApi.revokePermission(role, permission)
      } else {
        await adminApi.grantPermission(role, permission)
      }
    } catch (err) {
      setGrantedKeys((prev) => {
        const next = new Set(prev)
        if (wasGranted) next.add(key)
        else next.delete(key)
        return next
      })
      toast.error(getErrorMessage(err, 'Failed to update permission.'))
    } finally {
      setPendingKeys((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-slate-900">Roles &amp; Permissions</h1>
          <p className="text-sm text-slate-500">Control which roles can perform which actions.</p>
        </div>
        <SkeletonTable rows={10} cols={5} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-slate-900">Roles &amp; Permissions</h1>
          <p className="text-sm text-slate-500">Control which roles can perform which actions.</p>
        </div>
        <ErrorState message={error} onRetry={loadGrants} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-slate-900">Roles &amp; Permissions</h1>
        <p className="text-sm text-slate-500">
          Click a cell to grant or revoke a permission for a role. Changes take effect immediately.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-max border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">Permission</th>
              {ROLES.map((role) => (
                <th key={role} className="whitespace-nowrap px-4 py-3 text-center font-semibold text-slate-600">
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((group) => (
              <Fragment key={group.label}>
                <tr className="bg-slate-50/60">
                  <td
                    colSpan={ROLES.length + 1}
                    className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400"
                  >
                    {group.label}
                  </td>
                </tr>
                {group.permissions.map((permission) => (
                  <tr key={permission} className="border-b border-slate-100 last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-700">{permission}</td>
                    {ROLES.map((role) => {
                      const granted = isGranted(role, permission)
                      const isSuperAdmin = role === Role.SUPER_ADMIN
                      const key = grantKey(role, permission)
                      const isPending = pendingKeys.has(key)
                      return (
                        <td key={role} className="px-4 py-2.5 text-center">
                          <button
                            type="button"
                            disabled={isSuperAdmin || isPending}
                            onClick={() => toggle(role, permission)}
                            aria-pressed={granted}
                            aria-label={`${granted ? 'Revoke' : 'Grant'} ${permission} for ${role}`}
                            className={cn(
                              'inline-flex size-6 items-center justify-center rounded-md border transition-colors',
                              granted
                                ? 'border-brand-600 bg-brand-600 text-white'
                                : 'border-slate-300 bg-white text-transparent hover:border-slate-400',
                              isSuperAdmin && 'cursor-not-allowed opacity-80',
                              isPending && 'animate-pulse cursor-wait',
                            )}
                          >
                            {isSuperAdmin ? <Lock className="size-3.5" /> : <Check className="size-3.5" />}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-800">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <p>
          <span className="font-medium">Super Admin</span> bypasses every permission check on the server regardless
          of this table, so its column is shown as locked and cannot be restricted here.
        </p>
      </div>
    </div>
  )
}
