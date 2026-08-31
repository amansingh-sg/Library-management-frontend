import { apiClient } from './client'
import type { Reservation } from '@/types/models'

// POST /reservations/ — requires CREATE_RESERVATION
export async function createReservation(bookId: string): Promise<Reservation> {
  const { data } = await apiClient.post<Reservation>('/reservations/', { bookId })
  return data
}

// GET /reservations/me — requires VIEW_OWN_RESERVATIONS
export async function getMyReservations(): Promise<Reservation[]> {
  const { data } = await apiClient.get<Reservation[]>('/reservations/me')
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
