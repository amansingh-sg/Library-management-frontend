import { apiClient } from './client'
import type { ReservationStatus } from '@/types/enums'
import type { PageParams, PaginatedResponse, Reservation } from '@/types/models'

export type ReservationSortBy = 'reservedAt' | 'status'
export type SortOrder = 'ASC' | 'DESC'

interface ReservationSortParams {
  sortBy?: ReservationSortBy
  sortOrder?: SortOrder
  status?: ReservationStatus
  // Matches member name/email and book title - applied server-side against every
  // reservation, not just whatever page is currently loaded.
  search?: string
}

// GET /reservations/?sortBy=&sortOrder=&status=&search=&page=&per_page= — requires MANAGE_RESERVATIONS (every member's reservations)
export async function getAllReservations({
  page,
  perPage,
  sortBy,
  sortOrder,
  status,
  search,
}: PageParams & ReservationSortParams = {}): Promise<PaginatedResponse<Reservation>> {
  const params: Record<string, string | number> = {}
  if (page) params.page = page
  if (perPage) params.per_page = perPage
  if (sortBy) params.sortBy = sortBy
  if (sortOrder) params.sortOrder = sortOrder
  if (status) params.status = status
  if (search) params.search = search
  const { data } = await apiClient.get<PaginatedResponse<Reservation>>('/reservations/', { params })
  return data
}

// POST /reservations/ — requires CREATE_RESERVATION
export async function createReservation(bookId: string): Promise<Reservation> {
  const { data } = await apiClient.post<Reservation>('/reservations/', { bookId })
  return data
}

// GET /reservations/me?sortBy=&sortOrder=&page=&per_page= — requires VIEW_OWN_RESERVATIONS
export async function getMyReservations({
  page,
  perPage,
  sortBy,
  sortOrder,
  status,
}: PageParams & ReservationSortParams = {}): Promise<PaginatedResponse<Reservation>> {
  const params: Record<string, string | number> = {}
  if (page) params.page = page
  if (perPage) params.per_page = perPage
  if (sortBy) params.sortBy = sortBy
  if (sortOrder) params.sortOrder = sortOrder
  if (status) params.status = status
  const { data } = await apiClient.get<PaginatedResponse<Reservation>>('/reservations/me', { params })
  return data
}

// POST /reservations/:id/cancel — must own the reservation
export async function cancelReservation(id: string): Promise<Reservation> {
  const { data } = await apiClient.post<Reservation>(`/reservations/${id}/cancel`)
  return data
}

// POST /reservations/:id/fulfill — must own the reservation, status must be READY
export async function fulfillReservation(id: string): Promise<Reservation> {
  const { data } = await apiClient.post<Reservation>(`/reservations/${id}/fulfill`)
  return data
}
