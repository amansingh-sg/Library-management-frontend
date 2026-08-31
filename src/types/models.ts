import type { LoanStatus, Permission, ReservationStatus, Role } from './enums'

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
  mostBorrowed: BookAnalyticsRow[]
  mostFavourited: BookAnalyticsRow[]
  pendingReservations: BookAnalyticsRow[]
}

export type TrendPeriod = 'day' | 'week' | 'month'
