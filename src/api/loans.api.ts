import { apiClient } from './client'
import type { Loan, PageParams, PaginatedResponse } from '@/types/models'

// POST /loans/borrow — requires BORROW_BOOKS | ISSUE_LOANS | MANAGE_LOANS
export async function borrowBook(bookId: string): Promise<Loan> {
  const { data } = await apiClient.post<Loan>('/loans/borrow', { bookId })
  return data
}

// POST /loans/:id/return — authenticated, ownership enforced server-side
export async function returnLoan(id: string): Promise<Loan> {
  const { data } = await apiClient.post<Loan>(`/loans/${id}/return`)
  return data
}

// POST /loans/:id/renew — requires RENEW_LOANS | MANAGE_LOANS
export async function renewLoan(id: string): Promise<Loan> {
  const { data } = await apiClient.post<Loan>(`/loans/${id}/renew`)
  return data
}

// GET /loans/me?page=&per_page= — requires VIEW_OWN_LOANS. status includes derived "OVERDUE".
export async function getMyLoans({ page, perPage }: PageParams = {}): Promise<PaginatedResponse<Loan>> {
  const params: Record<string, number> = {}
  if (page) params.page = page
  if (perPage) params.per_page = perPage
  const { data } = await apiClient.get<PaginatedResponse<Loan>>('/loans/me', { params })
  return data
}

// GET /loans/?page=&per_page= — requires MANAGE_LOANS (all loans, admin/staff view)
export async function getAllLoans({ page, perPage }: PageParams = {}): Promise<PaginatedResponse<Loan>> {
  const params: Record<string, number> = {}
  if (page) params.page = page
  if (perPage) params.per_page = perPage
  const { data } = await apiClient.get<PaginatedResponse<Loan>>('/loans/', { params })
  return data
}
