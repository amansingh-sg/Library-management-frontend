import { apiClient } from './client'
import type { Author } from '@/types/models'

// GET /authors — requires VIEW_BOOKS (authors module reuses the books permission).
// Read-only: no create/update/delete endpoints exist on the backend.
export async function getAuthors(): Promise<Author[]> {
  const { data } = await apiClient.get<Author[]>('/authors')
  return data
}
