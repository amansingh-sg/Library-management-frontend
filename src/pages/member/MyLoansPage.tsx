import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle, Clock, Library, Loader2, PackageCheck, RotateCw } from 'lucide-react'
import { getMyLoans, renewLoan, returnLoan, type LoanSortBy, type LoanStatusFilter, type SortOrder } from '@/api/loans.api'
import { getBooks } from '@/api/books.api'
import { getErrorMessage } from '@/api/client'
import { PageHeader } from '@/components/member/PageHeader'
import { Table, type Column } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { StatusPills } from '@/components/ui/StatusPills'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { LoanStatusBadge } from '@/components/common/StatusBadge'
import { useAuth } from '@/hooks/useAuth'
import { Permission } from '@/types/enums'
import { formatDate, formatFine } from '@/utils/format'
import type { Loan, PaginatedResponse } from '@/types/models'

interface SortOption {
  value: string
  label: string
  sortBy: LoanSortBy
  sortOrder: SortOrder
}

const SORT_OPTIONS: SortOption[] = [
  { value: 'borrowedAt-desc', label: 'Newest loans first', sortBy: 'borrowedAt', sortOrder: 'DESC' },
  { value: 'borrowedAt-asc', label: 'Oldest loans first', sortBy: 'borrowedAt', sortOrder: 'ASC' },
  { value: 'dueAt-asc', label: 'Due date: soonest first', sortBy: 'dueAt', sortOrder: 'ASC' },
  { value: 'dueAt-desc', label: 'Due date: latest first', sortBy: 'dueAt', sortOrder: 'DESC' },
  { value: 'effectiveStatus-asc', label: 'Overdue loans first', sortBy: 'effectiveStatus', sortOrder: 'ASC' },
  { value: 'effectiveStatus-desc', label: 'Returned loans first', sortBy: 'effectiveStatus', sortOrder: 'DESC' },
  { value: 'book-asc', label: 'Book title (A–Z)', sortBy: 'book', sortOrder: 'ASC' },
  { value: 'book-desc', label: 'Book title (Z–A)', sortBy: 'book', sortOrder: 'DESC' },
]

const STATUS_OPTIONS: { value: LoanStatusFilter | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'RETURN_REQUESTED', label: 'Return requested' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'LOST', label: 'Lost' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'FINE_PAID', label: 'Fine paid' },
]

// Paginated list of the current member's loans, with status/sort filters. Members
// can request a return or renew a loan; staff decide the actual returned condition
// elsewhere (librarian confirmation flow), not here.
export default function MyLoansPage() {
  const { hasPermission } = useAuth()
  const [page, setPage] = useState<PaginatedResponse<Loan> | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [sortValue, setSortValue] = useState(SORT_OPTIONS[0].value)
  const [statusFilter, setStatusFilter] = useState<LoanStatusFilter | ''>('')
  const [bookTitleById, setBookTitleById] = useState<Map<string, string>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyLoanId, setBusyLoanId] = useState<string | null>(null)
  const [returnTarget, setReturnTarget] = useState<Loan | null>(null)

  const canRenew = hasPermission(Permission.RENEW_LOANS)
  const loans = page?.data ?? []
  const activeSort = SORT_OPTIONS.find((o) => o.value === sortValue) ?? SORT_OPTIONS[0]

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    // Books are fetched in full here (not paginated) — it's a title lookup map, not the
    // list this page paginates.
    Promise.all([
      getMyLoans({
        page: pageNumber,
        sortBy: activeSort.sortBy,
        sortOrder: activeSort.sortOrder,
        status: statusFilter || undefined,
      }),
      getBooks({}, { perPage: 500 }),
    ])
      .then(([loanResult, books]) => {
        setPage(loanResult)
        setBookTitleById(new Map(books.data.map((b) => [b.id, b.title])))
      })
      .catch((err) => setError(getErrorMessage(err, 'Unable to load your loans.')))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, sortValue, statusFilter])

  // Changing the sort or status filter jumps back to page 1, since staying on the
  // current page could land past the end of the new, differently-sized result set.
  useEffect(() => {
    setPageNumber(1)
  }, [sortValue, statusFilter])

  // Refetches whenever page, sort, or status filter changes (load() already depends
  // on all three).
  useEffect(() => {
    load()
  }, [load])

  async function handleReturn() {
    if (!returnTarget) return
    setBusyLoanId(returnTarget.id)
    try {
      await returnLoan(returnTarget.id)
      toast.success('Return requested - a librarian will confirm it shortly.')
      setReturnTarget(null)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to return this loan.'))
    } finally {
      setBusyLoanId(null)
    }
  }

  async function handleRenew(loan: Loan) {
    setBusyLoanId(loan.id)
    try {
      await renewLoan(loan.id)
      toast.success('Loan renewed.')
      load()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to renew this loan.'))
    } finally {
      setBusyLoanId(null)
    }
  }

  const columns = useMemo<Column<Loan>[]>(
    () => [
      { header: 'Book', accessor: (loan) => bookTitleById.get(loan.bookId) ?? loan.bookId },
      { header: 'Borrowed', accessor: (loan) => formatDate(loan.borrowedAt) },
      {
        header: 'Due',
        accessor: (loan) => (
          <span className={loan.status === 'OVERDUE' ? 'font-medium text-red-600' : undefined}>
            {formatDate(loan.dueAt)}
          </span>
        ),
      },
      { header: 'Status', accessor: (loan) => <LoanStatusBadge status={loan.status} /> },
      {
        header: 'Fine',
        accessor: (loan) =>
          loan.fineAmount > 0 ? (
            <span className="font-medium text-red-600">{formatFine(loan.fineAmount)}</span>
          ) : (
            '—'
          ),
      },
      {
        header: 'Actions',
        className: 'text-right',
        accessor: (loan) => {
          // Only an open loan (still out, not yet requested/finalized) can be
          // returned or renewed - see LoansService.returnLoan for the request/
          // finalize split.
          const isOpen = loan.status === 'ACTIVE' || loan.status === 'OVERDUE'
          const isReturning = busyLoanId === loan.id && returnTarget?.id === loan.id
          const isRenewing = busyLoanId === loan.id && returnTarget?.id !== loan.id

          if (loan.status === 'RETURN_REQUESTED') {
            return (
              <span className="inline-flex items-center justify-end gap-1.5 text-xs font-medium text-amber-600">
                <Clock className="size-3.5" />
                Awaiting confirmation
              </span>
            )
          }

          return (
            <div className="flex items-center justify-end gap-1.5">
              {/* This only requests a return - the member never records the book's
                  condition; a librarian confirms condition (and any fine) separately. */}
              {isOpen && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setReturnTarget(loan)}
                  isLoading={isReturning}
                  className="gap-1.5"
                >
                  {!isReturning && <PackageCheck className="size-3.5" />}
                  Return
                </Button>
              )}
              {isOpen && canRenew && (
                <button
                  type="button"
                  title="Renew loan"
                  aria-label="Renew loan"
                  disabled={Boolean(busyLoanId)}
                  onClick={() => handleRenew(loan)}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-600 disabled:opacity-40"
                >
                  {isRenewing ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
                </button>
              )}
            </div>
          )
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookTitleById, busyLoanId, returnTarget, canRenew],
  )

  if (isLoading) {
    return (
      <div>
        <PageHeader title="My Loans" description="Books you currently have, or have borrowed in the past." />
        <SkeletonTable rows={5} cols={5} />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <PageHeader title="My Loans" />
        <ErrorState message={error} onRetry={load} />
      </div>
    )
  }

  const totalDues = loans.reduce((sum, loan) => sum + loan.fineAmount, 0)

  return (
    <div>
      <PageHeader title="My Loans" description="Books you currently have, or have borrowed in the past." />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <StatusPills options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
        <div className="w-56">
          <Select label="Sort by" value={sortValue} onChange={(e) => setSortValue(e.target.value)}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {totalDues > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="size-4 shrink-0" />
          <p>
            You owe <span className="font-semibold">{formatFine(totalDues)}</span> in overdue fines on this page.
            Return your overdue books to stop them from growing.
          </p>
        </div>
      )}

      {loans.length === 0 ? (
        <EmptyState icon={Library} title="No loans yet" description="Books you borrow will show up here." />
      ) : (
        <>
          <Table columns={columns} data={loans} rowKey={(loan) => loan.id} />
          {page && <Pagination page={page} onPageChange={setPageNumber} isLoading={isLoading} />}
        </>
      )}

      <ConfirmDialog
        open={Boolean(returnTarget)}
        title="Return this book?"
        description={`Request a return for "${returnTarget ? bookTitleById.get(returnTarget.bookId) ?? 'this book' : ''}"? A librarian will confirm its condition before the copy is freed up for other members.`}
        confirmLabel="Request return"
        isLoading={Boolean(busyLoanId) && busyLoanId === returnTarget?.id}
        onConfirm={handleReturn}
        onCancel={() => setReturnTarget(null)}
      />
    </div>
  )
}
