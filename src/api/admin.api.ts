import { apiClient } from './client'
import type { AdminUser, RolePermissionGrant } from '@/types/models'
import type { Permission, Role } from '@/types/enums'

// GET /admin/users — requires MANAGE_USERS | MANAGE_MEMBERS.
// NOTE: the backend response also includes `password` (bcrypt hash) and
// `userUniqueKey` for every row (unfiltered entity serialization — a real security
// gap). We deliberately type the result without those fields and never read them.
export async function getUsers(): Promise<AdminUser[]> {
  const { data } = await apiClient.get<AdminUser[]>('/admin/users')
  return data
}

// PATCH /admin/users/:id/role — requires MANAGE_USERS
export async function updateUserRole(id: string, role: Role): Promise<AdminUser> {
  const { data } = await apiClient.patch<AdminUser>(`/admin/users/${id}/role`, { role })
  return data
}

// GET /admin/permissions — requires MANAGE_ROLE_PERMISSIONS, full grant table
export async function getAllRolePermissions(): Promise<RolePermissionGrant[]> {
  const { data } = await apiClient.get<RolePermissionGrant[]>('/admin/permissions')
  return data
}

// GET /admin/roles/:role/permissions — requires MANAGE_ROLE_PERMISSIONS
export async function getRolePermissions(role: Role): Promise<Permission[]> {
  const { data } = await apiClient.get<Permission[]>(`/admin/roles/${role}/permissions`)
  return data
}

// POST /admin/roles/:role/permissions — requires MANAGE_ROLE_PERMISSIONS, idempotent
export async function grantPermission(role: Role, permission: Permission): Promise<RolePermissionGrant> {
  const { data } = await apiClient.post<RolePermissionGrant>(`/admin/roles/${role}/permissions`, { permission })
  return data
}

// DELETE /admin/roles/:role/permissions/:permission — requires MANAGE_ROLE_PERMISSIONS
export async function revokePermission(role: Role, permission: Permission): Promise<void> {
  await apiClient.delete(`/admin/roles/${role}/permissions/${permission}`)
}
