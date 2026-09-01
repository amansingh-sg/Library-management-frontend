import { Fragment, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Check, Lock, RotateCcw, ShieldCheck, User as UserIcon, X } from 'lucide-react'
import * as adminApi from '@/api/admin.api'
import { getErrorMessage } from '@/api/client'
import { Permission, Role, getRoleChain } from '@/types/enums'
import type { AdminUser, EffectivePermission } from '@/types/models'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { Select } from '@/components/ui/Select'
import { cn } from '@/utils/cn'

interface PermissionGroup {
  label: string
  permissions: Permission[]
}

// ISSUE_LOANS and FULL_SYSTEM_ACCESS are deliberately left out of this list. Verified
// against the backend: FULL_SYSTEM_ACCESS is never checked by any route (SUPER_ADMIN
// bypasses every permission check directly, not via this permission), and ISSUE_LOANS
// only gates the same self-service borrow endpoint that BORROW_BOOKS already does — a
// role with BORROW_BOOKS gains nothing by also having ISSUE_LOANS. Showing either here
// would just be a checkbox that looks like it does something but doesn't.
const PERMISSION_GROUPS: PermissionGroup[] = [
  { label: 'Books', permissions: [Permission.VIEW_BOOKS, Permission.MANAGE_BOOKS] },
  {
    label: 'Loans',
    permissions: [
      Permission.BORROW_BOOKS,
      Permission.VIEW_OWN_LOANS,
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
  { label: 'System', permissions: [Permission.MANAGE_ROLE_PERMISSIONS] },
]

const ROLES = Object.values(Role)

type EffectivePermissionMap = Partial<Record<Permission, EffectivePermission>>

const TABS = [
  { key: 'users', label: 'Individual Users' },
  { key: 'roles', label: 'Role Defaults' },
] as const
type Tab = (typeof TABS)[number]['key']

export default function RolePermissionsPage() {
  const [tab, setTab] = useState<Tab>('users')

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-slate-900">Permissions</h1>
        <p className="text-sm text-slate-500">
          Every user gets their role&apos;s default permissions. Override an individual user here without changing
          the defaults everyone else with that role keeps.
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'px-3 py-2 text-sm font-medium transition-colors',
              tab === t.key
                ? 'border-b-2 border-brand-600 text-brand-700'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' ? <UserPermissionsPanel /> : <RoleDefaultsPanel />}
    </div>
  )
}

// ---- Individual user overrides ----

function UserPermissionsPanel() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [details, setDetails] = useState<EffectivePermissionMap>({})
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false)
  const [pendingKeys, setPendingKeys] = useState<Set<Permission>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadUsers() {
      setIsLoadingUsers(true)
      setError(null)
      try {
        // This dropdown needs every user, not one page of them.
        const { data } = await adminApi.getUsers({ perPage: 500 })
        setUsers(data)
        if (data.length > 0) setSelectedUserId(data[0].id)
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load users.'))
      } finally {
        setIsLoadingUsers(false)
      }
    }
    loadUsers()
  }, [])

  const selectedUser = useMemo(() => users.find((u) => u.id === selectedUserId) ?? null, [users, selectedUserId])

  async function loadPermissions(userId: string) {
    setIsLoadingPermissions(true)
    setError(null)
    try {
      const permissions = await adminApi.getUserPermissions(userId)
      const map: EffectivePermissionMap = {}
      permissions.forEach((p) => {
        map[p.permission] = p
      })
      setDetails(map)
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load this user's permissions."))
    } finally {
      setIsLoadingPermissions(false)
    }
  }

  useEffect(() => {
    if (selectedUserId) loadPermissions(selectedUserId)
  }, [selectedUserId])

  async function toggle(permission: Permission, nextGranted: boolean) {
    if (!selectedUser || selectedUser.role === Role.SUPER_ADMIN) return
    if (pendingKeys.has(permission)) return

    const previous = details[permission]
    setPendingKeys((prev) => new Set(prev).add(permission))
    setDetails((prev) => ({
      ...prev,
      [permission]: { permission, granted: nextGranted, source: nextGranted ? 'grant' : 'revoke' },
    }))

    try {
      await adminApi.setUserPermissionOverride(selectedUser.id, permission, nextGranted ? 'GRANT' : 'REVOKE')
    } catch (err) {
      setDetails((prev) => ({ ...prev, [permission]: previous ?? prev[permission] }))
      toast.error(getErrorMessage(err, 'Failed to update permission.'))
    } finally {
      setPendingKeys((prev) => {
        const next = new Set(prev)
        next.delete(permission)
        return next
      })
    }
  }

  async function resetToDefault(permission: Permission) {
    if (!selectedUser) return
    if (pendingKeys.has(permission)) return

    const previous = details[permission]
    setPendingKeys((prev) => new Set(prev).add(permission))

    try {
      await adminApi.clearUserPermissionOverride(selectedUser.id, permission)
      const refreshed = await adminApi.getUserPermissions(selectedUser.id)
      const map: EffectivePermissionMap = {}
      refreshed.forEach((p) => {
        map[p.permission] = p
      })
      setDetails(map)
    } catch (err) {
      setDetails((prev) => ({ ...prev, [permission]: previous ?? prev[permission] }))
      toast.error(getErrorMessage(err, 'Failed to reset permission.'))
    } finally {
      setPendingKeys((prev) => {
        const next = new Set(prev)
        next.delete(permission)
        return next
      })
    }
  }

  if (isLoadingUsers) return <SkeletonTable rows={8} cols={2} />
  if (error && users.length === 0) return <ErrorState message={error} onRetry={() => window.location.reload()} />

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-xs">
        <Select
          label="User"
          name="permission-user"
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
        >
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.firstName} {user.lastName} — {user.email} ({user.role})
            </option>
          ))}
        </Select>
      </div>

      {selectedUser?.role === Role.SUPER_ADMIN && (
        <div className="flex items-start gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-800">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-medium">Super Admin</span> bypasses every permission check on the server, so this
            user&apos;s permissions cannot be restricted here.
          </p>
        </div>
      )}

      {isLoadingPermissions && <SkeletonTable rows={10} cols={1} />}

      {!isLoadingPermissions && error && <ErrorState message={error} onRetry={() => selectedUserId && loadPermissions(selectedUserId)} />}

      {!isLoadingPermissions && !error && selectedUser && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-max border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">Permission</th>
                <th className="whitespace-nowrap px-4 py-3 text-center font-semibold text-slate-600">Granted</th>
                <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">Source</th>
                <th className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600" />
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map((group) => (
                <Fragment key={group.label}>
                  <tr className="bg-slate-50/60">
                    <td colSpan={4} className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {group.label}
                    </td>
                  </tr>
                  {group.permissions.map((permission) => {
                    const detail = details[permission]
                    const isSuperAdmin = selectedUser.role === Role.SUPER_ADMIN
                    const granted = isSuperAdmin ? true : (detail?.granted ?? false)
                    const source = isSuperAdmin ? 'role' : (detail?.source ?? 'role')
                    const isPending = pendingKeys.has(permission)
                    const isOverridden = source !== 'role'

                    return (
                      <tr key={permission} className="border-b border-slate-100 last:border-0">
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-700">{permission}</td>
                        <td className="px-4 py-2.5 text-center">
                          <button
                            type="button"
                            disabled={isSuperAdmin || isPending}
                            onClick={() => toggle(permission, !granted)}
                            aria-pressed={granted}
                            aria-label={`${granted ? 'Revoke' : 'Grant'} ${permission} for this user`}
                            className={cn(
                              'inline-flex size-6 items-center justify-center rounded-md border transition-colors',
                              granted
                                ? 'border-brand-600 bg-brand-600 text-white'
                                : 'border-slate-300 bg-white text-transparent hover:border-slate-400',
                              isSuperAdmin && 'cursor-not-allowed opacity-80',
                              isPending && 'animate-pulse cursor-wait',
                            )}
                          >
                            {isSuperAdmin ? <Lock className="size-3.5" /> : granted ? (
                              <Check className="size-3.5" />
                            ) : (
                              <X className="size-3.5 text-slate-300" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                              source === 'role' && 'bg-slate-100 text-slate-600',
                              source === 'grant' && 'bg-emerald-100 text-emerald-700',
                              source === 'revoke' && 'bg-rose-100 text-rose-700',
                            )}
                          >
                            {source === 'role' ? 'Role default' : source === 'grant' ? 'Override: granted' : 'Override: revoked'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {!isSuperAdmin && isOverridden && (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => resetToDefault(permission)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50"
                            >
                              <RotateCcw className="size-3" />
                              Reset to default
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoadingUsers && users.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          <UserIcon className="size-4" />
          No users found.
        </div>
      )}
    </div>
  )
}

// ---- Role defaults (cumulative by hierarchy) ----

function RoleDefaultsPanel() {
  const [grantedKeys, setGrantedKeys] = useState<Set<string>>(new Set())
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function grantKey(role: Role, permission: Permission): string {
    return `${role}:${permission}`
  }

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

  const ownGrant = useMemo(
    () => (role: Role, permission: Permission) => grantedKeys.has(grantKey(role, permission)),
    [grantedKeys],
  )

  // The nearest role below `role` in the hierarchy whose OWN grants include
  // `permission`, or null if it isn't inherited from anywhere. This is what lets the
  // grid show "LIBRARIAN has ISSUE_LOANS because it inherits it from MEMBER" instead
  // of leaving the cell blank and looking like the role doesn't have it at all.
  const inheritedFrom = useMemo(
    () => (role: Role, permission: Permission): Role | null => {
      const chain = getRoleChain(role).filter((r) => r !== role)
      return chain.reverse().find((r) => ownGrant(r, permission)) ?? null
    },
    [ownGrant],
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

  if (isLoading) return <SkeletonTable rows={10} cols={5} />
  if (error) return <ErrorState message={error} onRetry={loadGrants} />

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-slate-500">
        Roles are cumulative: LIBRARIAN inherits MEMBER, and SUPER_ADMIN inherits LIBRARIAN. A solid check means the
        permission is granted at that role&apos;s own level (click to revoke); a greyed check means it&apos;s
        inherited from a role below and can only be changed by editing that role&apos;s own column.
      </p>

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
                      const isSuperAdmin = role === Role.SUPER_ADMIN
                      const own = ownGrant(role, permission)
                      const inheritedFromRole = isSuperAdmin ? null : inheritedFrom(role, permission)
                      const granted = isSuperAdmin || own || Boolean(inheritedFromRole)
                      const key = grantKey(role, permission)
                      const isPending = pendingKeys.has(key)
                      // Inherited grants aren't directly editable here — you'd revoke them
                      // at the role they actually come from, which cascades up automatically.
                      const isEditable = !isSuperAdmin && !inheritedFromRole
                      return (
                        <td key={role} className="px-4 py-2.5 text-center">
                          <button
                            type="button"
                            disabled={!isEditable || isPending}
                            onClick={() => toggle(role, permission)}
                            aria-pressed={granted}
                            aria-label={
                              isSuperAdmin
                                ? `${permission} always granted for SUPER_ADMIN`
                                : inheritedFromRole
                                  ? `${permission} inherited from ${inheritedFromRole} for ${role}`
                                  : `${granted ? 'Revoke' : 'Grant'} ${permission} for ${role}`
                            }
                            title={inheritedFromRole ? `Inherited from ${inheritedFromRole}` : undefined}
                            className={cn(
                              'inline-flex size-6 items-center justify-center rounded-md border transition-colors',
                              own && 'border-brand-600 bg-brand-600 text-white',
                              !own &&
                                inheritedFromRole &&
                                'border-slate-300 bg-slate-200 text-slate-500',
                              !granted && 'border-slate-300 bg-white text-transparent hover:border-slate-400',
                              !isEditable && 'cursor-not-allowed opacity-90',
                              isPending && 'animate-pulse cursor-wait',
                            )}
                          >
                            {isSuperAdmin || inheritedFromRole ? (
                              <Lock className="size-3.5" />
                            ) : (
                              <Check className="size-3.5" />
                            )}
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
