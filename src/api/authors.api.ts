import { apiClient } from './client'
import type { Author } from '@/types/models'

// GET /authors — requires VIEW_BOOKS (authors module reuses the books permission).
export async function getAuthors(): Promise<Author[]> {
  const { data } = await apiClient.get<Author[]>('/authors')
  return data
}

// POST /authors — requires MANAGE_BOOKS (same permission as adding/deleting a book).
export async function createAuthor(name: string, bio?: string): Promise<Author> {
  const { data } = await apiClient.post<Author>('/authors', { name, bio })
  return data
}
