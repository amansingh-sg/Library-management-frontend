import { apiClient } from './client'
import type { Book, CreateBookPayload } from '@/types/models'

export interface BookFilters {
  search?: string
  title?: string
  author?: string
  category?: string
}

// GET /books?search=&title=&author=&category= — flat array, no pagination (verified).
export async function getBooks(filters: BookFilters = {}): Promise<Book[]> {
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
  const { data } = await apiClient.get<Book[]>('/books', { params })
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
