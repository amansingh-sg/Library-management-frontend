import { apiClient } from './client'
import type { Loan, PageParams, PaginatedResponse } from '@/types/models'

// 'status' sorts by the raw DB column (ACTIVE/RETURNED only). 'effectiveStatus' sorts
// by the same derived status the API returns (OVERDUE included) - see
// loans.repository.ts's SORT_COLUMNS for the SQL that computes it.
export type LoanSortBy = 'borrowedAt' | 'dueAt' | 'status' | 'effectiveStatus' | 'book' | 'borrower'
export type SortOrder = 'ASC' | 'DESC'
// Mutually exclusive with each other - matches exactly what the API's derived
// `status` field ever shows (see loans.service.ts's getLoanStatus).
// FINE_PAID isn't a loan status - it's "has a fine ever been recorded as paid on
// this loan" (see loans.repository.ts's applyStatusFilter), orthogonal to
// ACTIVE/OVERDUE/RETURNED.
export type LoanStatusFilter = 'ACTIVE' | 'OVERDUE' | 'RETURNED' | 'FINE_PAID'

interface LoanSortParams {
  sortBy?: LoanSortBy
  sortOrder?: SortOrder
  status?: LoanStatusFilter
  // Matches borrower name/email and book title - applied server-side against every
  // loan, not just whatever page is currently loaded (see getAllLoans below).
  search?: string
}

// POST /loans/borrow — requires BORROW_BOOKS | ISSUE_LOANS | MANAGE_LOANS
export async function borrowBook(bookId: string): Promise<Loan> {
  const { data } = await apiClient.post<Loan>('/loans/borrow', { bookId })
  return data
}

// POST /loans/issue — requires ISSUE_LOANS | MANAGE_LOANS. Librarian/staff issuing a
// loan to a specific member, distinct from borrowBook (which checks the book out to
// the caller themselves).
export async function issueLoan(userId: string, bookId: string): Promise<Loan> {
  const { data } = await apiClient.post<Loan>('/loans/issue', { userId, bookId })
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

// POST /loans/:id/pay-fine — requires MANAGE_LOANS. Records the loan's current fine
// as paid; a still-active, still-overdue loan can accrue a new fine afterwards, at
// which point this can be called again. 409s if there's nothing outstanding.
export async function payLoanFine(id: string): Promise<Loan> {
  const { data } = await apiClient.post<Loan>(`/loans/${id}/pay-fine`)
  return data
}

// GET /loans/me?sortBy=&sortOrder=&page=&per_page= — requires VIEW_OWN_LOANS. status includes derived "OVERDUE".
export async function getMyLoans({
  page,
  perPage,
  sortBy,
  sortOrder,
  status,
}: PageParams & LoanSortParams = {}): Promise<PaginatedResponse<Loan>> {
  const params: Record<string, string | number> = {}
  if (page) params.page = page
  if (perPage) params.per_page = perPage
  if (sortBy) params.sortBy = sortBy
  if (sortOrder) params.sortOrder = sortOrder
  if (status) params.status = status
  const { data } = await apiClient.get<PaginatedResponse<Loan>>('/loans/me', { params })
  return data
}

// GET /loans/?sortBy=&sortOrder=&status=&search=&page=&per_page= — requires MANAGE_LOANS (all loans, admin/staff view)
export async function getAllLoans({
  page,
  perPage,
  sortBy,
  sortOrder,
  status,
  search,
}: PageParams & LoanSortParams = {}): Promise<PaginatedResponse<Loan>> {
  const params: Record<string, string | number> = {}
  if (page) params.page = page
  if (perPage) params.per_page = perPage
  if (sortBy) params.sortBy = sortBy
  if (sortOrder) params.sortOrder = sortOrder
  if (status) params.status = status
  if (search) params.search = search
  const { data } = await apiClient.get<PaginatedResponse<Loan>>('/loans/', { params })
  return data
}

export interface LoanBorrower {
  id: string
  email: string
  firstName: string
  lastName: string
}

// GET /loans/book/:bookId?search=&page=&per_page= — requires MANAGE_LOANS. Current
// (ACTIVE/OVERDUE) borrowers of one specific book, librarian/super admin book-detail view.
export async function getBookBorrowers(
  bookId: string,
  { search, page, perPage }: PageParams & { search?: string } = {},
): Promise<PaginatedResponse<Loan & { user: LoanBorrower }>> {
  const params: Record<string, string | number> = {}
  if (search) params.search = search
  if (page) params.page = page
  if (perPage) params.per_page = perPage
  const { data } = await apiClient.get<PaginatedResponse<Loan & { user: LoanBorrower }>>(
    `/loans/book/${bookId}`,
    { params },
  )
  return data
}
