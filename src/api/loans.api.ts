import { apiClient } from './client'
import type { Loan } from '@/types/models'

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

// GET /loans/me — requires VIEW_OWN_LOANS. status includes derived "OVERDUE".
export async function getMyLoans(): Promise<Loan[]> {
  const { data } = await apiClient.get<Loan[]>('/loans/me')
  return data
}

// GET /loans/ — requires MANAGE_LOANS (all loans, admin/staff view)
export async function getAllLoans(): Promise<Loan[]> {
  const { data } = await apiClient.get<Loan[]>('/loans/')
  return data
}
