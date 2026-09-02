import { apiClient } from './client'
import type {
  AdminUser,
  RolePermissionGrant,
  EffectivePermission,
  UserPermissionOverride,
  PermissionOverrideType,
  PageParams,
  PaginatedResponse,
} from '@/types/models'
import type { Permission, Role } from '@/types/enums'

export type UserSortBy = 'firstName' | 'email' | 'role' | 'isActive' | 'createdAt'
export type SortOrder = 'ASC' | 'DESC'

interface UserSortParams {
  sortBy?: UserSortBy
  sortOrder?: SortOrder
}

// GET /admin/users?page=&per_page=&sortBy=&sortOrder= — requires MANAGE_USERS | MANAGE_MEMBERS.
// NOTE: the backend response also includes `password` (bcrypt hash) and
// `userUniqueKey` for every row (unfiltered entity serialization — a real security
// gap). We deliberately type the result without those fields and never read them.
export async function getUsers({
  page,
  perPage,
  sortBy,
  sortOrder,
}: PageParams & UserSortParams = {}): Promise<PaginatedResponse<AdminUser>> {
  const params: Record<string, string | number> = {}
  if (page) params.page = page
  if (perPage) params.per_page = perPage
  if (sortBy) params.sortBy = sortBy
  if (sortOrder) params.sortOrder = sortOrder
  const { data } = await apiClient.get<PaginatedResponse<AdminUser>>('/admin/users', { params })
  return data
}

// PATCH /admin/users/:id/role — requires MANAGE_USERS
export async function updateUserRole(id: string, role: Role): Promise<AdminUser> {
  const { data } = await apiClient.patch<AdminUser>(`/admin/users/${id}/role`, { role })
  return data
}

// PATCH /admin/users/:id/status — requires MANAGE_USERS. Deactivating blocks that
// user's login but preserves their loan/reservation/favourite history. The backend
// also rejects an admin deactivating their own account.
export async function updateUserStatus(id: string, isActive: boolean): Promise<AdminUser> {
  const { data } = await apiClient.patch<AdminUser>(`/admin/users/${id}/status`, { isActive })
  return data
}

export interface CreateUserPayload {
  email: string
  password: string
  firstName: string
  lastName: string
  dob: string
  role: Role
}

// POST /admin/users — requires CREATE_USERS. The role the caller may assign is
// capped server-side (LIBRARIAN can only create STAFF/MEMBER; SUPER_ADMIN can create
// any role) - a request for a role above that ceiling gets a 403.
export async function createUser(payload: CreateUserPayload): Promise<AdminUser> {
  const { data } = await apiClient.post<AdminUser>('/admin/users', payload)
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

// GET /admin/users/:id/permissions — requires MANAGE_ROLE_PERMISSIONS
// Every known permission for this user, with its effective state (granted/denied) and
// whether that comes from their role's cumulative default or an individual override.
export async function getUserPermissions(userId: string): Promise<EffectivePermission[]> {
  const { data } = await apiClient.get<EffectivePermission[]>(`/admin/users/${userId}/permissions`)
  return data
}

// PUT /admin/users/:id/permissions/:permission — requires MANAGE_ROLE_PERMISSIONS
// Sets an individual override for this user without touching their role's defaults.
export async function setUserPermissionOverride(
  userId: string,
  permission: Permission,
  type: PermissionOverrideType,
): Promise<UserPermissionOverride> {
  const { data } = await apiClient.put<UserPermissionOverride>(
    `/admin/users/${userId}/permissions/${permission}`,
    { type },
  )
  return data
}

// DELETE /admin/users/:id/permissions/:permission — requires MANAGE_ROLE_PERMISSIONS
// Clears an individual override, reverting the user back to their role's default for
// that permission.
export async function clearUserPermissionOverride(userId: string, permission: Permission): Promise<void> {
  await apiClient.delete(`/admin/users/${userId}/permissions/${permission}`)
}
