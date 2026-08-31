import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Pencil, Search, Users as UsersIcon } from 'lucide-react'
import * as adminApi from '@/api/admin.api'
import { getErrorMessage } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { Permission, Role } from '@/types/enums'
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

const roleTone: Record<Role, 'purple' | 'blue' | 'green' | 'slate'> = {
  [Role.SUPER_ADMIN]: 'purple',
  [Role.LIBRARIAN]: 'blue',
  [Role.STAFF]: 'green',
  [Role.MEMBER]: 'slate',
}

export default function UsersPage() {
  const { hasPermission } = useAuth()
  const canManageRoles = hasPermission(Permission.MANAGE_USERS)

  const [users, setUsers] = useState<AdminUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [selectedRole, setSelectedRole] = useState<Role>(Role.MEMBER)
  const [isSaving, setIsSaving] = useState(false)

  async function loadUsers() {
    setIsLoading(true)
    setError(null)
    try {
      const data = await adminApi.getUsers()
      setUsers(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load users.'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

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
      setUsers((prev) => prev.map((user) => (user.id === updated.id ? updated : user)))
      toast.success(`Updated ${updated.email}'s role to ${updated.role}.`)
      setEditingUser(null)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update role.'))
    } finally {
      setIsSaving(false)
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
      header: 'Actions',
      accessor: (user) =>
        canManageRoles ? (
          <Button variant="outline" size="sm" onClick={() => openEditModal(user)}>
            <Pencil className="size-3.5" />
            Edit role
          </Button>
        ) : (
          <span className="text-xs text-slate-400">No permission</span>
        ),
      className: 'text-right',
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-slate-900">Users</h1>
        <p className="text-sm text-slate-500">Manage member accounts and assign roles.</p>
      </div>

      <div className="max-w-xs">
        <Input
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          name="user-search"
        />
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
        <Table columns={columns} data={filteredUsers} rowKey={(user) => user.id} />
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
          {Object.values(Role).map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </Select>
      </Modal>
    </div>
  )
}
