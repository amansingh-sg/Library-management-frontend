import { apiClient } from './client'
import type { Favourite, PageParams, PaginatedResponse } from '@/types/models'

export type SortOrder = 'ASC' | 'DESC'

interface FavouriteSortParams {
  sortOrder?: SortOrder
}

// POST /books/:id/favourite — authenticated only, no permission gate
export async function addFavourite(bookId: string): Promise<Favourite> {
  const { data } = await apiClient.post<Favourite>(`/books/${bookId}/favourite`)
  return data
}

// DELETE /books/:id/favourite
export async function removeFavourite(bookId: string): Promise<void> {
  await apiClient.delete(`/books/${bookId}/favourite`)
}

// GET /users/me/favourites?sortOrder=&page=&per_page=
export async function getMyFavourites({
  page,
  perPage,
  sortOrder,
}: PageParams & FavouriteSortParams = {}): Promise<PaginatedResponse<Favourite>> {
  const params: Record<string, string | number> = {}
  if (page) params.page = page
  if (perPage) params.per_page = perPage
  if (sortOrder) params.sortOrder = sortOrder
  const { data } = await apiClient.get<PaginatedResponse<Favourite>>('/users/me/favourites', { params })
  return data
}

// GET /favourites?sortOrder=&page=&per_page= — requires MANAGE_BOOKS (every member's favourites)
export async function getAllFavourites({
  page,
  perPage,
  sortOrder,
}: PageParams & FavouriteSortParams = {}): Promise<PaginatedResponse<Favourite>> {
  const params: Record<string, string | number> = {}
  if (page) params.page = page
  if (perPage) params.per_page = perPage
  if (sortOrder) params.sortOrder = sortOrder
  const { data } = await apiClient.get<PaginatedResponse<Favourite>>('/favourites', { params })
  return data
}
