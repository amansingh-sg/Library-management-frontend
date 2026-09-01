import { apiClient } from './client'
import type { Book, CreateBookPayload, PageParams, PaginatedResponse } from '@/types/models'

export interface BookFilters {
  search?: string
  title?: string
  author?: string
  category?: string
}

// GET /books?search=&title=&author=&category=&page=&per_page=
export async function getBooks(
  filters: BookFilters = {},
  { page, perPage }: PageParams = {},
): Promise<PaginatedResponse<Book>> {
  const params: Record<string, string | number> = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v),
  )
  if (page) params.page = page
  if (perPage) params.per_page = perPage
  const { data } = await apiClient.get<PaginatedResponse<Book>>('/books', { params })
  return data
}

export async function getBookById(id: string): Promise<Book> {
  const { data } = await apiClient.get<Book>(`/books/${id}`)
  return data
}

// POST /books — requires MANAGE_BOOKS
export async function createBook(payload: CreateBookPayload): Promise<Book> {
  const { data } = await apiClient.post<Book>('/books', payload)
  return data
}

// DELETE /books/:id — requires MANAGE_BOOKS, soft delete
export async function deleteBook(id: string): Promise<void> {
  await apiClient.delete(`/books/${id}`)
}
