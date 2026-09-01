import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Library, RotateCw, Search } from 'lucide-react'
import { getAllLoans, renewLoan, returnLoan } from '@/api/loans.api'
import { getBooks } from '@/api/books.api'
import { getUsers } from '@/api/admin.api'
import { getErrorMessage } from '@/api/client'
import { PageHeader } from '@/components/member/PageHeader'
import { Table, type Column } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { LoanStatusBadge } from '@/components/common/StatusBadge'
import { formatDate, formatFine } from '@/utils/format'
import type { AdminUser, Loan, PaginatedResponse } from '@/types/models'

export default function LoansManagementPage() {
  const [page, setPage] = useState<PaginatedResponse<Loan> | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [bookTitleById, setBookTitleById] = useState<Map<string, string>>(new Map())
  const [userById, setUserById] = useState<Map<string, AdminUser>>(new Map())
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyLoanId, setBusyLoanId] = useState<string | null>(null)
  const [returnTarget, setReturnTarget] = useState<Loan | null>(null)

  const loans = page?.data ?? []

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    // Books/users are fetched in full here (not paginated) — they're lookup maps for
    // rendering titles/borrower names, not the list this page paginates.
    Promise.all([getAllLoans({ page: pageNumber }), getBooks({}, { perPage: 500 }), getUsers({ perPage: 500 })])
      .then(([loanResult, books, users]) => {
        setPage(loanResult)
        setBookTitleById(new Map(books.data.map((b) => [b.id, b.title])))
        setUserById(new Map(users.data.map((u) => [u.id, u])))
      })
      .catch((err) => setError(getErrorMessage(err, 'Unable to load loans.')))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber])

  useEffect(() => {
    load()
  }, [load])

  function borrowerLabel(userId: string): string {
    const user = userById.get(userId)
    if (!user) return userId
    return `${user.firstName} ${user.lastName} (${user.email})`
  }

  const filteredLoans = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return loans
    return loans.filter((loan) => {
      const borrower = borrowerLabel(loan.userId).toLowerCase()
      const title = (bookTitleById.get(loan.bookId) ?? '').toLowerCase()
      return borrower.includes(term) || title.includes(term)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loans, search, userById, bookTitleById])

  async function handleReturn() {
    if (!returnTarget) return
    setBusyLoanId(returnTarget.id)
    try {
      await returnLoan(returnTarget.id)
      toast.success('Loan marked as returned.')
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
      { header: 'Borrower', accessor: (loan) => borrowerLabel(loan.userId) },
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
        accessor: (loan) => (
          <div className="flex items-center gap-2">
            {loan.status !== 'RETURNED' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReturnTarget(loan)}
                isLoading={busyLoanId === loan.id && returnTarget?.id === loan.id}
              >
                Return
              </Button>
            )}
            {loan.status !== 'RETURNED' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRenew(loan)}
                isLoading={busyLoanId === loan.id && returnTarget?.id !== loan.id}
              >
                <RotateCw className="size-3.5" />
                Renew
              </Button>
            )}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookTitleById, userById, busyLoanId, returnTarget],
  )

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Loans" description="Every loan across all members, and who's holding what." />
        <SkeletonTable rows={8} cols={6} />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Loans" />
        <ErrorState message={error} onRetry={load} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Loans"
        description="Every loan across all members, and who's holding what. See Dashboard/Analytics for library-wide overdue and fine totals."
      />

      <div className="mb-4 max-w-xs">
        <Input
          placeholder="Search this page by borrower or book"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          name="loan-search"
        />
      </div>

      {loans.length === 0 ? (
        <EmptyState icon={Library} title="No loans yet" description="Loans members take out will show up here." />
      ) : filteredLoans.length === 0 ? (
        <EmptyState icon={Search} title="No matching loans" description="Try a different search term." />
      ) : (
        <>
          <Table columns={columns} data={filteredLoans} rowKey={(loan) => loan.id} />
          {page && <Pagination page={page} onPageChange={setPageNumber} isLoading={isLoading} />}
        </>
      )}

      <ConfirmDialog
        open={Boolean(returnTarget)}
        title="Return this book?"
        description={`Mark "${returnTarget ? bookTitleById.get(returnTarget.bookId) ?? 'this book' : ''}" as returned by ${returnTarget ? borrowerLabel(returnTarget.userId) : ''}?`}
        confirmLabel="Return"
        isLoading={Boolean(busyLoanId) && busyLoanId === returnTarget?.id}
        onConfirm={handleReturn}
        onCancel={() => setReturnTarget(null)}
      />
    </div>
  )
}
