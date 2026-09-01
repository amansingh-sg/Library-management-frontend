import { apiClient } from './client'
import type { Favourite, PageParams, PaginatedResponse } from '@/types/models'

// POST /books/:id/favourite — authenticated only, no permission gate
export async function addFavourite(bookId: string): Promise<Favourite> {
  const { data } = await apiClient.post<Favourite>(`/books/${bookId}/favourite`)
  return data
}

// DELETE /books/:id/favourite
export async function removeFavourite(bookId: string): Promise<void> {
  await apiClient.delete(`/books/${bookId}/favourite`)
}

// GET /users/me/favourites?page=&per_page=
export async function getMyFavourites({ page, perPage }: PageParams = {}): Promise<PaginatedResponse<Favourite>> {
  const params: Record<string, number> = {}
  if (page) params.page = page
  if (perPage) params.per_page = perPage
  const { data } = await apiClient.get<PaginatedResponse<Favourite>>('/users/me/favourites', { params })
  return data
}
