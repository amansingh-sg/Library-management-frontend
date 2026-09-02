import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Pencil, Plus, Search, UserX, UserCheck, Users as UsersIcon } from 'lucide-react'
import * as adminApi from '@/api/admin.api'
import { getErrorMessage } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { Permission, Role, getRoleChain } from '@/types/enums'
import type { AdminUser } from '@/types/models'
import { Table, type Column } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { PaginatedResponse } from '@/types/models'

const roleTone: Record<Role, 'purple' | 'blue' | 'amber' | 'slate'> = {
  [Role.SUPER_ADMIN]: 'purple',
  [Role.LIBRARIAN]: 'blue',
  [Role.STAFF]: 'amber',
  [Role.MEMBER]: 'slate',
}

const EMPTY_NEW_USER = { email: '', password: '', firstName: '', lastName: '', dob: '' }

interface SortOption {
  value: string
  label: string
  sortBy: adminApi.UserSortBy
  sortOrder: adminApi.SortOrder
}

const SORT_OPTIONS: SortOption[] = [
  { value: 'createdAt-desc', label: 'Newest accounts first', sortBy: 'createdAt', sortOrder: 'DESC' },
  { value: 'createdAt-asc', label: 'Oldest accounts first', sortBy: 'createdAt', sortOrder: 'ASC' },
  { value: 'firstName-asc', label: 'Name (A–Z)', sortBy: 'firstName', sortOrder: 'ASC' },
  { value: 'firstName-desc', label: 'Name (Z–A)', sortBy: 'firstName', sortOrder: 'DESC' },
  { value: 'email-asc', label: 'Email (A–Z)', sortBy: 'email', sortOrder: 'ASC' },
  { value: 'role-asc', label: 'Group by role', sortBy: 'role', sortOrder: 'ASC' },
  { value: 'isActive-asc', label: 'Deactivated accounts first', sortBy: 'isActive', sortOrder: 'ASC' },
]

export default function UsersPage() {
  const { hasPermission, user: currentUser } = useAuth()
  const canManageRoles = hasPermission(Permission.MANAGE_USERS)
  const canCreateUsers = hasPermission(Permission.CREATE_USERS)

  // Mirrors AdministrationService.createUser's role ceiling: SUPER_ADMIN can assign
  // any role except SUPER_ADMIN itself (minting more super admins is kept out of the
  // app's UI entirely - a privilege-escalation guard); anyone else with CREATE_USERS
  // can only assign a role strictly below their own. The backend re-enforces this
  // regardless of what's offered here.
  const assignableRoles = useMemo(() => {
    if (!currentUser) return []
    const rolesBelowSuperAdmin = Object.values(Role).filter((role) => role !== Role.SUPER_ADMIN)
    if (currentUser.role === Role.SUPER_ADMIN) return rolesBelowSuperAdmin
    return getRoleChain(currentUser.role).filter((role) => role !== currentUser.role)
  }, [currentUser])

  const [page, setPage] = useState<PaginatedResponse<AdminUser> | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [sortValue, setSortValue] = useState(SORT_OPTIONS[0].value)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const activeSort = SORT_OPTIONS.find((o) => o.value === sortValue) ?? SORT_OPTIONS[0]

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)

  // Mirrors AdministrationService.updateUserRole's guard: SUPER_ADMIN can never be
  // assigned through this action. Kept visible only when it's the user being edited's
  // current role, so an existing super admin's row still displays correctly - it's
  // never offered as a fresh promotion target for anyone else.
  const editableRoles = useMemo(() => {
    const rolesBelowSuperAdmin = Object.values(Role).filter((role) => role !== Role.SUPER_ADMIN)
    if (editingUser?.role === Role.SUPER_ADMIN) return [Role.SUPER_ADMIN, ...rolesBelowSuperAdmin]
    return rolesBelowSuperAdmin
  }, [editingUser])
  const [selectedRole, setSelectedRole] = useState<Role>(Role.MEMBER)
  const [isSaving, setIsSaving] = useState(false)

  // Only SUPER_ADMIN can deactivate/reactivate accounts (MANAGE_USERS is a
  // SUPER_ADMIN-only base grant - see AdministrationService.setUserActiveStatus).
  // The backend also rejects self-deactivation, so that row's action is hidden here
  // to avoid a confusing 403 round-trip.
  const [statusTarget, setStatusTarget] = useState<AdminUser | null>(null)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  // Keeps rendering the last real target's details while the dialog closes (its exit
  // animation briefly keeps the panel mounted after statusTarget resets to null) so it
  // never flashes "undefined" text instead of the account it was just showing.
  const [statusDialogUser, setStatusDialogUser] = useState<AdminUser | null>(null)

  const [addUserOpen, setAddUserOpen] = useState(false)
  const [newUser, setNewUser] = useState(EMPTY_NEW_USER)
  const [newUserRole, setNewUserRole] = useState<Role>(Role.MEMBER)
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [createUserError, setCreateUserError] = useState<string | null>(null)

  const users = page?.data ?? []

  async function loadUsers() {
    setIsLoading(true)
    setError(null)
    try {
      const result = await adminApi.getUsers({
        page: pageNumber,
        sortBy: activeSort.sortBy,
        sortOrder: activeSort.sortOrder,
      })
      setPage(result)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load users.'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, sortValue])

  useEffect(() => {
    setPageNumber(1)
  }, [sortValue])

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return users
    return users.filter((user) => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase()
      return fullName.includes(term) || user.email.toLowerCase().includes(term)
    })
  }, [users, search])

  function openEditModal(user: AdminUser) {
    setEditingUser(user)
    setSelectedRole(user.role)
  }

  function closeEditModal() {
    if (isSaving) return
    setEditingUser(null)
  }

  async function handleSaveRole() {
    if (!editingUser) return
    setIsSaving(true)
    try {
      const updated = await adminApi.updateUserRole(editingUser.id, selectedRole)
      setPage((prev) => prev && { ...prev, data: prev.data.map((user) => (user.id === updated.id ? updated : user)) })
      toast.success(`Updated ${updated.email}'s role to ${updated.role}.`)
      setEditingUser(null)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update role.'))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleToggleStatus() {
    if (!statusTarget) return
    setIsUpdatingStatus(true)
    try {
      const nextIsActive = !statusTarget.isActive
      const updated = await adminApi.updateUserStatus(statusTarget.id, nextIsActive)
      setPage((prev) => prev && { ...prev, data: prev.data.map((user) => (user.id === updated.id ? updated : user)) })
      toast.success(nextIsActive ? `Reactivated ${updated.email}.` : `Deactivated ${updated.email}.`)
      setStatusTarget(null)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update account status.'))
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  function openAddUserModal() {
    setNewUser(EMPTY_NEW_USER)
    setNewUserRole(assignableRoles[0] ?? Role.MEMBER)
    setCreateUserError(null)
    setAddUserOpen(true)
  }

  async function handleCreateUser() {
    setCreateUserError(null)

    if (!newUser.email.trim() || !newUser.password || !newUser.firstName.trim() || !newUser.lastName.trim() || !newUser.dob) {
      setCreateUserError('All fields are required.')
      return
    }
    if (newUser.password.length < 8) {
      setCreateUserError('Password must be at least 8 characters long.')
      return
    }

    setIsCreatingUser(true)
    try {
      await adminApi.createUser({
        email: newUser.email.trim(),
        password: newUser.password,
        firstName: newUser.firstName.trim(),
        lastName: newUser.lastName.trim(),
        dob: newUser.dob,
        role: newUserRole,
      })
      toast.success(`Created account for ${newUser.email.trim()}.`)
      setAddUserOpen(false)
      loadUsers()
    } catch (err) {
      setCreateUserError(getErrorMessage(err, 'Unable to create this user.'))
    } finally {
      setIsCreatingUser(false)
    }
  }

  const columns: Column<AdminUser>[] = [
    {
      header: 'Name',
      accessor: (user) => (
        <span className="font-medium text-slate-900">
          {user.firstName} {user.lastName}
        </span>
      ),
    },
    { header: 'Email', accessor: (user) => user.email },
    {
      header: 'Status',
      accessor: (user) => (
        <Badge tone={user.isVerified ? 'green' : 'amber'}>{user.isVerified ? 'Verified' : 'Unverified'}</Badge>
      ),
    },
    {
      header: 'Role',
      accessor: (user) => <Badge tone={roleTone[user.role]}>{user.role}</Badge>,
    },
    {
      header: 'Account',
      accessor: (user) => (
        <Badge tone={user.isActive ? 'green' : 'red'}>{user.isActive ? 'Active' : 'Deactivated'}</Badge>
      ),
    },
    {
      header: 'Actions',
      accessor: (user) =>
        canManageRoles ? (
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => openEditModal(user)}>
              <Pencil className="size-3.5" />
              Edit role
            </Button>
            {user.id !== currentUser?.id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusTarget(user)
                  setStatusDialogUser(user)
                }}
              >
                {user.isActive ? <UserX className="size-3.5" /> : <UserCheck className="size-3.5" />}
                {user.isActive ? 'Deactivate' : 'Reactivate'}
              </Button>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-400">No permission</span>
        ),
      className: 'text-right',
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500">Manage member accounts and assign roles.</p>
        </div>
        {canCreateUsers && (
          <Button onClick={openAddUserModal}>
            <Plus className="size-4" />
            Add user
          </Button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="max-w-xs flex-1">
          <Input
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            name="user-search"
          />
        </div>
        <div className="w-56">
          <Select label="Sort by" value={sortValue} onChange={(e) => setSortValue(e.target.value)}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading && <SkeletonTable rows={6} cols={5} />}

      {!isLoading && error && <ErrorState message={error} onRetry={loadUsers} />}

      {!isLoading && !error && filteredUsers.length === 0 && (
        <EmptyState
          icon={search ? Search : UsersIcon}
          title={search ? 'No matching users' : 'No users yet'}
          description={search ? 'Try a different search term.' : 'Registered members will appear here.'}
        />
      )}

      {!isLoading && !error && filteredUsers.length > 0 && (
        <>
          <Table columns={columns} data={filteredUsers} rowKey={(user) => user.id} />
          {page && <Pagination page={page} onPageChange={setPageNumber} isLoading={isLoading} />}
        </>
      )}

      <Modal
        open={Boolean(editingUser)}
        onClose={closeEditModal}
        title={editingUser ? `Edit role — ${editingUser.email}` : 'Edit role'}
        footer={
          <>
            <Button variant="outline" onClick={closeEditModal} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveRole} isLoading={isSaving}>
              Save
            </Button>
          </>
        }
      >
        <Select
          label="Role"
          name="role"
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value as Role)}
        >
          {editableRoles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </Select>
      </Modal>

      <Modal
        open={addUserOpen}
        onClose={() => setAddUserOpen(false)}
        title="Add a user"
        footer={
          <>
            <Button variant="outline" onClick={() => setAddUserOpen(false)} disabled={isCreatingUser}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} isLoading={isCreatingUser}>
              Create user
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            value={newUser.email}
            onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
          />
          <Input
            label="Password"
            type="password"
            hint="At least 8 characters."
            value={newUser.password}
            onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First name"
              value={newUser.firstName}
              onChange={(e) => setNewUser((u) => ({ ...u, firstName: e.target.value }))}
            />
            <Input
              label="Last name"
              value={newUser.lastName}
              onChange={(e) => setNewUser((u) => ({ ...u, lastName: e.target.value }))}
            />
          </div>
          <Input
            label="Date of birth"
            type="date"
            value={newUser.dob}
            onChange={(e) => setNewUser((u) => ({ ...u, dob: e.target.value }))}
          />
          <Select
            label="Role"
            value={newUserRole}
            onChange={(e) => setNewUserRole(e.target.value as Role)}
          >
            {assignableRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </Select>
          {createUserError && <p className="text-sm text-red-600">{createUserError}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(statusTarget)}
        title={statusDialogUser?.isActive ? 'Deactivate this account?' : 'Reactivate this account?'}
        description={
          statusDialogUser?.isActive
            ? `${statusDialogUser.email} will no longer be able to log in. Their loan, reservation and favourite history is kept, and this can be reversed at any time.`
            : `${statusDialogUser?.email} will be able to log in again.`
        }
        confirmLabel={statusDialogUser?.isActive ? 'Deactivate' : 'Reactivate'}
        danger={statusDialogUser?.isActive}
        isLoading={isUpdatingStatus}
        onConfirm={handleToggleStatus}
        onCancel={() => setStatusTarget(null)}
      />
    </div>
  )
}
