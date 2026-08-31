// Mirrors src/database/model/role.enum.ts on the backend — verified against source.
export const Role = {
  MEMBER: 'MEMBER',
  STAFF: 'STAFF',
  LIBRARIAN: 'LIBRARIAN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const
export type Role = (typeof Role)[keyof typeof Role]

// Mirrors src/database/model/permission.enum.ts on the backend — verified against source.
export const Permission = {
  VIEW_BOOKS: 'VIEW_BOOKS',
  MANAGE_BOOKS: 'MANAGE_BOOKS',
  BORROW_BOOKS: 'BORROW_BOOKS',
  VIEW_OWN_LOANS: 'VIEW_OWN_LOANS',
  ISSUE_LOANS: 'ISSUE_LOANS',
  RETURN_LOANS: 'RETURN_LOANS',
  RENEW_LOANS: 'RENEW_LOANS',
  MANAGE_LOANS: 'MANAGE_LOANS',
  CREATE_RESERVATION: 'CREATE_RESERVATION',
  VIEW_OWN_RESERVATIONS: 'VIEW_OWN_RESERVATIONS',
  MANAGE_RESERVATIONS: 'MANAGE_RESERVATIONS',
  MANAGE_MEMBERS: 'MANAGE_MEMBERS',
  MANAGE_USERS: 'MANAGE_USERS',
  MANAGE_ROLE_PERMISSIONS: 'MANAGE_ROLE_PERMISSIONS',
  FULL_SYSTEM_ACCESS: 'FULL_SYSTEM_ACCESS',
} as const
export type Permission = (typeof Permission)[keyof typeof Permission]

// Mirrors src/database/model/reservation-status.enum.ts on the backend — verified against source.
export const ReservationStatus = {
  WAITING: 'WAITING',
  READY: 'READY',
  FULFILLED: 'FULFILLED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const
export type ReservationStatus = (typeof ReservationStatus)[keyof typeof ReservationStatus]

// Backend loan.status column is only ACTIVE|RETURNED; LoansService derives OVERDUE
// client-side-visible-only on list/get responses (see loans.service.ts:getLoanStatus).
export type LoanStatus = 'ACTIVE' | 'RETURNED' | 'OVERDUE'

// Default role -> permission seed from migration 1787240686929-CreateRolePermissions.ts.
// This is ONLY a best-effort default for client-side nav filtering — the backend's
// role_permissions table is the real source of truth and can be edited at runtime via
// /admin/roles/:role/permissions. Every privileged action is still re-checked by the
// backend (which returns 403 if the live grant differs), so a stale value here can
// only ever hide/show a nav item incorrectly, never bypass real authorization.
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.MEMBER]: [
    Permission.VIEW_BOOKS,
    Permission.BORROW_BOOKS,
    Permission.VIEW_OWN_LOANS,
    Permission.CREATE_RESERVATION,
    Permission.VIEW_OWN_RESERVATIONS,
  ],
  [Role.STAFF]: [
    Permission.VIEW_BOOKS,
    Permission.VIEW_OWN_LOANS,
    Permission.ISSUE_LOANS,
    Permission.RETURN_LOANS,
    Permission.RENEW_LOANS,
  ],
  [Role.LIBRARIAN]: [
    Permission.VIEW_BOOKS,
    Permission.MANAGE_BOOKS,
    Permission.ISSUE_LOANS,
    Permission.MANAGE_LOANS,
    Permission.MANAGE_MEMBERS,
    Permission.MANAGE_RESERVATIONS,
  ],
  [Role.SUPER_ADMIN]: Object.values(Permission),
}
