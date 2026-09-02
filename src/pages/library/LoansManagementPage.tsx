import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { CircleDollarSign, Library, Plus, RotateCw, Search } from 'lucide-react'
import {
  getAllLoans,
  issueLoan,
  payLoanFine,
  renewLoan,
  returnLoan,
  type LoanSortBy,
  type LoanStatusFilter,
  type SortOrder,
} from '@/api/loans.api'
import { getBooks } from '@/api/books.api'
import { getUsers } from '@/api/admin.api'
import { getErrorMessage } from '@/api/client'
import { useDebounce } from '@/hooks/useDebounce'
import { PageHeader } from '@/components/member/PageHeader'
import { Table, type Column } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { StatusPills } from '@/components/ui/StatusPills'
import { Combobox } from '@/components/ui/Combobox'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { LoanStatusBadge } from '@/components/common/StatusBadge'
import { useAuth } from '@/hooks/useAuth'
import { Permission } from '@/types/enums'
import { formatDate, formatFine } from '@/utils/format'
import type { AdminUser, Book, Loan, PaginatedResponse } from '@/types/models'

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
  { value: 'borrower-asc', label: 'Borrower name (A–Z)', sortBy: 'borrower', sortOrder: 'ASC' },
  { value: 'borrower-desc', label: 'Borrower name (Z–A)', sortBy: 'borrower', sortOrder: 'DESC' },
]

const STATUS_OPTIONS: { value: LoanStatusFilter | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'FINE_PAID', label: 'Fine paid' },
]

export default function LoansManagementPage() {
  const { hasPermission } = useAuth()
  // STAFF sees this page read-only (VIEW_ALL_LOANS, no action permissions) - LIBRARIAN+
  // holds MANAGE_LOANS and can act on any loan.
  const canManageLoans = hasPermission(Permission.MANAGE_LOANS)
  const canIssueLoans = hasPermission(Permission.ISSUE_LOANS, Permission.MANAGE_LOANS)
  const [page, setPage] = useState<PaginatedResponse<Loan> | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [sortValue, setSortValue] = useState(SORT_OPTIONS[0].value)
  const [statusFilter, setStatusFilter] = useState<LoanStatusFilter | ''>('')
  const [books, setBooks] = useState<Book[]>([])
  const [bookTitleById, setBookTitleById] = useState<Map<string, string>>(new Map())
  const [userById, setUserById] = useState<Map<string, AdminUser>>(new Map())
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyLoanId, setBusyLoanId] = useState<string | null>(null)
  const [returnTarget, setReturnTarget] = useState<Loan | null>(null)
  const [payFineTarget, setPayFineTarget] = useState<Loan | null>(null)
  const [isPayingFine, setIsPayingFine] = useState(false)
  // Keeps rendering the last real target's details while the dialog closes (its exit
  // animation briefly keeps the panel mounted after payFineTarget resets to null) so
  // it never flashes empty/undefined text - same reasoning as UsersPage's
  // statusDialogUser.
  const [payFineDialogLoan, setPayFineDialogLoan] = useState<Loan | null>(null)

  const [issueOpen, setIssueOpen] = useState(false)
  const [issueUserId, setIssueUserId] = useState('')
  const [issueBookId, setIssueBookId] = useState('')
  const [isIssuing, setIsIssuing] = useState(false)
  const [issueError, setIssueError] = useState<string | null>(null)

  const loans = page?.data ?? []
  const activeSort = SORT_OPTIONS.find((o) => o.value === sortValue) ?? SORT_OPTIONS[0]
  const debouncedSearch = useDebounce(search, 500)

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    // Books/users are fetched in full here (not paginated) — they're lookup maps for
    // rendering titles/borrower names, not the list this page paginates. getUsers
    // requires MANAGE_USERS/MANAGE_MEMBERS, which STAFF doesn't hold (they only get
    // read-only VIEW_ALL_LOANS) - fall back to an empty map on 403 rather than letting
    // it fail the whole page, so STAFF still sees the loans list (borrower shown by ID
    // instead of name).
    //
    // Search runs server-side against every loan (see getAllLoans) - it used to only
    // filter whichever page of results happened to already be loaded, which silently
    // missed matches sitting on a page that hadn't been fetched yet.
    Promise.all([
      getAllLoans({
        page: pageNumber,
        sortBy: activeSort.sortBy,
        sortOrder: activeSort.sortOrder,
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
      }),
      getBooks({}, { perPage: 500 }),
      getUsers({ perPage: 500 }).catch(() => ({ data: [] as AdminUser[] })),
    ])
      .then(([loanResult, bookResult, users]) => {
        setPage(loanResult)
        setBooks(bookResult.data)
        setBookTitleById(new Map(bookResult.data.map((b) => [b.id, b.title])))
        setUserById(new Map(users.data.map((u) => [u.id, u])))
      })
      .catch((err) => setError(getErrorMessage(err, 'Unable to load loans.')))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, sortValue, statusFilter, debouncedSearch])

  useEffect(() => {
    setPageNumber(1)
  }, [sortValue, statusFilter, debouncedSearch])

  useEffect(() => {
    load()
  }, [load])

  function borrowerLabel(userId: string): string {
    const user = userById.get(userId)
    if (!user) return userId
    return `${user.firstName} ${user.lastName} (${user.email})`
  }

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

  function openIssueModal() {
    setIssueUserId('')
    setIssueBookId('')
    setIssueError(null)
    setIssueOpen(true)
  }

  async function handleIssueLoan() {
    setIssueError(null)
    if (!issueUserId || !issueBookId) {
      setIssueError('Choose both a member and a book.')
      return
    }

    setIsIssuing(true)
    try {
      await issueLoan(issueUserId, issueBookId)
      toast.success('Loan issued.')
      setIssueOpen(false)
      load()
    } catch (err) {
      setIssueError(getErrorMessage(err, 'Unable to issue this loan.'))
    } finally {
      setIsIssuing(false)
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

  async function handlePayFine() {
    if (!payFineTarget) return
    setIsPayingFine(true)
    try {
      await payLoanFine(payFineTarget.id)
      toast.success(`Recorded ${formatFine(payFineTarget.fineAmount)} as paid.`)
      setPayFineTarget(null)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to record this fine as paid.'))
    } finally {
      setIsPayingFine(false)
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
        // Distinguishes "never had a fine" (—) from "had one, already settled"
        // (Fine paid) - fineAmount alone can't tell them apart since it's always 0
        // once finePaidAmount has been recorded (see loans.service.ts's
        // toLoanDto/outstandingFine), the same as a loan that was simply never
        // late. Without this, a librarian looking at a blank Fine cell has no way
        // to tell whether this loan is done and settled or was never an issue.
        accessor: (loan) =>
          loan.fineAmount > 0 ? (
            <span className="font-medium text-red-600">{formatFine(loan.fineAmount)}</span>
          ) : loan.finePaidAmount > 0 ? (
            <Badge tone="green">Fine paid</Badge>
          ) : (
            '—'
          ),
      },
      ...(canManageLoans
        ? [
            {
              header: 'Actions',
              accessor: (loan: Loan) => (
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
                  {loan.fineAmount > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPayFineTarget(loan)
                        setPayFineDialogLoan(loan)
                      }}
                    >
                      <CircleDollarSign className="size-3.5" />
                      Pay fine
                    </Button>
                  )}
                </div>
              ),
            },
          ]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookTitleById, userById, busyLoanId, returnTarget, canManageLoans],
  )

  return (
    <div>
      <PageHeader
        title="Loans"
        description="Every loan across all members, and who's holding what. See Dashboard/Analytics for library-wide overdue and fine totals."
        action={
          canIssueLoans && (
            <Button onClick={openIssueModal}>
              <Plus className="size-4" />
              Issue loan
            </Button>
          )
        }
      />

      <div className="mb-4">
        <StatusPills options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="max-w-xs flex-1">
          <Input
            placeholder="Search by borrower or book"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            name="loan-search"
          />
        </div>
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

      {isLoading ? (
        <SkeletonTable rows={8} cols={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loans.length === 0 ? (
        search || statusFilter ? (
          <EmptyState icon={Search} title="No matching loans" description="Try a different search term or filter." />
        ) : (
          <EmptyState icon={Library} title="No loans yet" description="Loans members take out will show up here." />
        )
      ) : (
        <>
          <Table columns={columns} data={loans} rowKey={(loan) => loan.id} />
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

      <ConfirmDialog
        open={Boolean(payFineTarget)}
        title="Record this fine as paid?"
        description={
          payFineDialogLoan
            ? `Record ${formatFine(payFineDialogLoan.fineAmount)} as paid by ${borrowerLabel(payFineDialogLoan.userId)} for "${bookTitleById.get(payFineDialogLoan.bookId) ?? 'this book'}"? This only settles what's owed right now - if the loan is still out and overdue, it can keep accruing afterwards.`
            : ''
        }
        confirmLabel="Record payment"
        isLoading={isPayingFine}
        onConfirm={handlePayFine}
        onCancel={() => setPayFineTarget(null)}
      />

      <Modal
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        title="Issue a loan"
        footer={
          <>
            <Button variant="outline" onClick={() => setIssueOpen(false)} disabled={isIssuing}>
              Cancel
            </Button>
            <Button onClick={handleIssueLoan} isLoading={isIssuing}>
              Issue loan
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Combobox
            label="Member"
            placeholder="Search members by name or email…"
            value={issueUserId}
            onChange={setIssueUserId}
            options={Array.from(userById.values()).map((user) => ({
              value: user.id,
              label: `${user.firstName} ${user.lastName}`,
              sublabel: user.email,
            }))}
            emptyMessage="No matching members"
          />
          <Combobox
            label="Book"
            placeholder="Search books by title…"
            value={issueBookId}
            onChange={setIssueBookId}
            options={books
              .filter((book) => book.availableCopies > 0)
              .map((book) => ({
                value: book.id,
                label: book.title,
                sublabel: `${book.availableCopies} available`,
              }))}
            emptyMessage="No available books match"
          />
          {issueError && <p className="text-sm text-red-600">{issueError}</p>}
        </div>
      </Modal>
    </div>
  )
}
