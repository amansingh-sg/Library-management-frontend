import { apiClient } from './client'
import type { Favourite } from '@/types/models'

// POST /books/:id/favourite — authenticated only, no permission gate
export async function addFavourite(bookId: string): Promise<Favourite> {
  const { data } = await apiClient.post<Favourite>(`/books/${bookId}/favourite`)
  return data
}

// DELETE /books/:id/favourite
export async function removeFavourite(bookId: string): Promise<void> {
  await apiClient.delete(`/books/${bookId}/favourite`)
}

// GET /users/me/favourites
export async function getMyFavourites(): Promise<Favourite[]> {
  const { data } = await apiClient.get<Favourite[]>('/users/me/favourites')
  return data
}
