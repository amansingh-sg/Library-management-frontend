// Mirrors src/database/model/role.enum.ts on the backend — verified against source.
// STAFF was reintroduced by migration ReintroduceStaffRole1787900000003 with a real,
// distinct grant (catalogue management — add/delete books) after being removed
// earlier (migration RemoveStaffRole1787900000002) for having none.
export const Role = {
  MEMBER: 'MEMBER',
  STAFF: 'STAFF',
  LIBRARIAN: 'LIBRARIAN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const
export type Role = (typeof Role)[keyof typeof Role]

// Mirrors ROLE_HIERARCHY in src/database/model/role.enum.ts — each role inherits every
// permission of the role before it (MEMBER -> STAFF -> LIBRARIAN -> SUPER_ADMIN).
export const ROLE_HIERARCHY: Role[] = [Role.MEMBER, Role.STAFF, Role.LIBRARIAN, Role.SUPER_ADMIN]

// Every role from MEMBER up to and including `role`, ascending by privilege.
export function getRoleChain(role: Role): Role[] {
  const index = ROLE_HIERARCHY.indexOf(role)
  if (index === -1) return [role]
  return ROLE_HIERARCHY.slice(0, index + 1)
}

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
  VIEW_ALL_LOANS: 'VIEW_ALL_LOANS',
  CREATE_RESERVATION: 'CREATE_RESERVATION',
  VIEW_OWN_RESERVATIONS: 'VIEW_OWN_RESERVATIONS',
  MANAGE_RESERVATIONS: 'MANAGE_RESERVATIONS',
  VIEW_ALL_RESERVATIONS: 'VIEW_ALL_RESERVATIONS',
  MANAGE_MEMBERS: 'MANAGE_MEMBERS',
  MANAGE_USERS: 'MANAGE_USERS',
  CREATE_USERS: 'CREATE_USERS',
  VIEW_LIBRARY_ANALYTICS: 'VIEW_LIBRARY_ANALYTICS',
  VIEW_ALL_FAVOURITES: 'VIEW_ALL_FAVOURITES',
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

// Each role's OWN default permissions (not cumulative) — mirrors the base grants seeded
// by migration 1787900000003-ReintroduceStaffRole.ts. Roles are cumulative by
// hierarchy (see ROLE_HIERARCHY above): a role also inherits every base permission of
// every role before it in the chain — see DEFAULT_ROLE_PERMISSIONS below.
//
// This is ONLY a best-effort default for client-side nav filtering — the backend's
// role_permissions table (plus any per-user overrides) is the real source of truth and
// can be edited at runtime via the admin permissions panel. Every privileged action is
// still re-checked by the backend (which returns 403 if the live grant differs), so a
// stale value here can only ever hide/show a nav item incorrectly, never bypass real
// authorization.
const BASE_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.MEMBER]: [
    Permission.VIEW_BOOKS,
    Permission.BORROW_BOOKS,
    Permission.VIEW_OWN_LOANS,
    Permission.CREATE_RESERVATION,
    Permission.VIEW_OWN_RESERVATIONS,
  ],
  [Role.STAFF]: [
    Permission.MANAGE_BOOKS,
    Permission.VIEW_ALL_LOANS,
    Permission.VIEW_ALL_RESERVATIONS,
    Permission.VIEW_ALL_FAVOURITES,
  ],
  [Role.LIBRARIAN]: [
    Permission.ISSUE_LOANS,
    Permission.RETURN_LOANS,
    Permission.RENEW_LOANS,
    Permission.MANAGE_LOANS,
    Permission.MANAGE_RESERVATIONS,
    Permission.MANAGE_MEMBERS,
    Permission.VIEW_LIBRARY_ANALYTICS,
    Permission.CREATE_USERS,
  ],
  [Role.SUPER_ADMIN]: [Permission.MANAGE_USERS, Permission.MANAGE_ROLE_PERMISSIONS, Permission.FULL_SYSTEM_ACCESS],
}

// A role's effective (cumulative) default permissions — its own base grants plus every
// base grant of the roles below it in the hierarchy.
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = Object.fromEntries(
  Object.values(Role).map((role) => [
    role,
    Array.from(new Set(getRoleChain(role).flatMap((chainRole) => BASE_ROLE_PERMISSIONS[chainRole]))),
  ]),
) as Record<Role, Permission[]>
