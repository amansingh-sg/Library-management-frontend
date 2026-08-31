import { apiClient } from './client'
import type {
  BookAnalytics,
  DashboardSummary,
  MemberAnalyticsRow,
  OverdueLoanRow,
  TrendPeriod,
  TrendPoint,
} from '@/types/models'

// GET /analytics/books?limit= — requires MANAGE_BOOKS
export async function getBookAnalytics(limit = 10): Promise<BookAnalytics> {
  const { data } = await apiClient.get<BookAnalytics>('/analytics/books', { params: { limit } })
  return data
}

// GET /analytics/members — requires MANAGE_USERS
export async function getMemberAnalytics(): Promise<MemberAnalyticsRow[]> {
  const { data } = await apiClient.get<MemberAnalyticsRow[]>('/analytics/members')
  return data
}

// GET /analytics/borrowing-trends?period= — requires MANAGE_BOOKS
export async function getBorrowingTrends(period: TrendPeriod = 'month'): Promise<TrendPoint[]> {
  const { data } = await apiClient.get<TrendPoint[]>('/analytics/borrowing-trends', { params: { period } })
  return data
}

// GET /analytics/reservation-trends?period= — requires MANAGE_BOOKS
export async function getReservationTrends(period: TrendPeriod = 'month'): Promise<TrendPoint[]> {
  const { data } = await apiClient.get<TrendPoint[]>('/analytics/reservation-trends', { params: { period } })
  return data
}

// GET /analytics/pending-reservations — requires MANAGE_BOOKS
export async function getPendingReservations(): Promise<BookAnalytics['pendingReservations']> {
  const { data } = await apiClient.get<BookAnalytics['pendingReservations']>('/analytics/pending-reservations')
  return data
}

// GET /analytics/overdue-loans — requires MANAGE_LOANS
export async function getOverdueLoans(): Promise<OverdueLoanRow[]> {
  const { data } = await apiClient.get<OverdueLoanRow[]>('/analytics/overdue-loans')
  return data
}

// GET /analytics/dashboard — requires MANAGE_BOOKS
// NOTE: `pendingReservations` here is an ARRAY (books-with-waiters), not the numeric
// count, due to a key-collision bug in the backend's response assembly. Derive a count
// with `.length` — see DashboardSummary jsdoc in types/models.ts.
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await apiClient.get<DashboardSummary>('/analytics/dashboard')
  return data
}
