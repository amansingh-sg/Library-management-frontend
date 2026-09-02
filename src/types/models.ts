import type { LoanStatus, Permission, ReservationStatus, Role } from './enums'

// Matches typeorm-pagination's PaginationAwareObject (backend) — every list endpoint
// (books, loans, reservations, admin users, favourites) returns this shape. Request a
// page with `?page=&per_page=` (both optional, default page=1 per_page=15).
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  per_page: number
  current_page: number
  last_page: number
  from: number | null
  to: number | null
  prev_page: number | null
  next_page: number | null
}

export interface PageParams {
  page?: number
  perPage?: number
}

// GET /books, GET /books/:id — flat entity, no nested author/category (verified: books
// controller/repository never eager-loads or selects the joined relations).
export interface Book {
  id: string
  title: string
  isbn: string
  publishedYear: number | null
  totalCopies: number
  availableCopies: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  authorId: string
  categoryId: string
}

export interface CreateBookPayload {
  title: string
  isbn: string
  authorId: string
  categoryId: string
  publishedYear?: number
  totalCopies: number
}

// GET /authors
export interface Author {
  id: string
  name: string
  bio: string | null
}

// There is no categories API on the backend (verified: no controller/route/service
// exists). This is a client-side-only convenience list matching the categories the
// seed script creates with fixed ids, so the UI can show names instead of raw uuids.
export interface SeedCategory {
  id: string
  name: string
}

// Decoded JWT claims (access token), see authenticate-request.ts / user.service.ts.
export interface AuthTokenPayload {
  id: string
  email: string
  role: Role
  iat: number
  exp: number
}

export interface AuthSession {
  id: string
  email: string
  token: string
  refreshToken?: string
}

// POST /register no longer returns a token - the account isn't verified yet, so it
// wouldn't work against login-gated routes anyway. The user must click the
// verification link (which does log them in, via AuthSession from /user-email-verification).
export interface RegisteredAccount {
  id: string
  email: string
}

export interface RegisterPayload {
  email: string
  password: string
  firstName: string
  lastName: string
  dob: string
  marketing?: boolean
}

export interface LoginPayload {
  email: string
  password: string
}

// GET /admin/users — the backend currently also returns `password` and
// `userUniqueKey` on this entity (unfiltered TypeORM serialization, a real security
// gap flagged during inspection). This type intentionally OMITS them and the frontend
// must never read/render those two fields even though they may be present on the wire.
export interface AdminUser {
  id: string
  email: string
  firstName: string
  lastName: string
  dob: string
  isVerified: boolean
  isActive: boolean
  role: Role
}

export interface Loan {
  id: string
  bookId: string
  userId: string
  borrowedAt: string
  dueAt: string
  returnedAt: string | null
  status: LoanStatus
  createdAt: string
  updatedAt: string
  // What's still OUTSTANDING - accrues while overdue and unreturned, frozen at
  // whatever it was on the day it was returned, minus anything already recorded as
  // paid (finePaidAmount). 0 if never overdue or fully paid. See
  // fine-calculator.ts on the backend.
  fineAmount: number
  // Cumulative amount recorded as paid via the librarian/admin "mark as paid"
  // action (see LoansService.payFine) - not itself the outstanding balance, see
  // fineAmount above for that.
  finePaidAmount: number
  finePaidAt: string | null
  finePaidBy: string | null
}

export interface Reservation {
  id: string
  userId: string
  bookId: string
  status: ReservationStatus
  reservedAt: string
  readyAt: string | null
  expiresAt: string | null
  fulfilledAt: string | null
  cancelledAt: string | null
}

export interface Favourite {
  id: string
  userId: string
  bookId: string
  createdAt: string
}

export interface RolePermissionGrant {
  id: string
  role: Role
  permission: Permission
  createdAt: string
}

export type PermissionOverrideType = 'GRANT' | 'REVOKE'

export interface UserPermissionOverride {
  id: string
  userId: string
  permission: Permission
  type: PermissionOverrideType
  createdAt: string
}

// A single permission's effective state for one user: whether it is granted, and
// whether that comes from their role's cumulative default or an individual override.
export interface EffectivePermission {
  permission: Permission
  granted: boolean
  source: 'role' | 'grant' | 'revoke'
}

// ---- Analytics (all raw JSON, no envelope) ----

export interface BookAnalyticsRow {
  id: string
  title: string
  total_copies?: number
  available_copies?: number
  borrow_count?: number | string
  favourite_count?: number | string
  reservation_count?: number | string
  waiting_count?: number | string
}

export interface BookAnalytics {
  mostBorrowed: BookAnalyticsRow[]
  mostFavourited: BookAnalyticsRow[]
  mostReserved: BookAnalyticsRow[]
  pendingReservations: BookAnalyticsRow[]
}

export interface MemberAnalyticsRow {
  userId: string
  email: string
  totalLoans: number
  totalReservations: number
  totalFavourites: number
  lastActivity: string | null
  engagementScore: number
  category: 'Highly Active' | 'Active' | 'At Risk' | 'Inactive'
  rank: number
}

export interface TrendPoint {
  period: string
  borrow_count?: number | string
  reservation_count?: number | string
}

export interface OverdueLoanRow {
  id: string
  user_id: string
  book_id: string
  title: string
  borrowed_at: string
  due_at: string
  email: string
  // Outstanding amount - already net of anything paid (see backend's outstandingFine).
  fineAmount: number
  // Raw lifetime-paid total (string - comes straight off a numeric Postgres column).
  // Lets the UI tell "never had a fine" apart from "had one, already settled" even
  // though fineAmount is 0 in both cases - see LoansManagementPage's "Fine paid" badge.
  fine_paid_amount: string
}

// GET /analytics/dashboard — note: due to a backend key-collision bug, the
// `pendingReservations` field here is the ARRAY of books-with-waiters (same shape as
// BookAnalytics.pendingReservations), not the numeric count from getDashboardSummary().
// Use pendingReservations.length for a KPI count. Verified in analytics.service.ts.
export interface DashboardSummary {
  totalBooks: number
  totalMembers: number
  activeLoans: number
  overdueLoans: number
  totalOutstandingFines: number
  mostBorrowed: BookAnalyticsRow[]
  mostFavourited: BookAnalyticsRow[]
  pendingReservations: BookAnalyticsRow[]
}

export type TrendPeriod = 'day' | 'week' | 'month'
