import { apiClient } from './client'
import type { PageParams, PaginatedResponse, Reservation } from '@/types/models'

// GET /reservations/?page=&per_page= — requires MANAGE_RESERVATIONS (every member's reservations)
export async function getAllReservations({
  page,
  perPage,
}: PageParams = {}): Promise<PaginatedResponse<Reservation>> {
  const params: Record<string, number> = {}
  if (page) params.page = page
  if (perPage) params.per_page = perPage
  const { data } = await apiClient.get<PaginatedResponse<Reservation>>('/reservations/', { params })
  return data
}

// POST /reservations/ — requires CREATE_RESERVATION
export async function createReservation(bookId: string): Promise<Reservation> {
  const { data } = await apiClient.post<Reservation>('/reservations/', { bookId })
  return data
}

// GET /reservations/me?page=&per_page= — requires VIEW_OWN_RESERVATIONS
export async function getMyReservations({
  page,
  perPage,
}: PageParams = {}): Promise<PaginatedResponse<Reservation>> {
  const params: Record<string, number> = {}
  if (page) params.page = page
  if (perPage) params.per_page = perPage
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
