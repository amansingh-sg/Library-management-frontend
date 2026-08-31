import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Library, RotateCw } from 'lucide-react'
import { getMyLoans, renewLoan, returnLoan } from '@/api/loans.api'
import { getBooks } from '@/api/books.api'
import { getErrorMessage } from '@/api/client'
import { PageHeader } from '@/components/member/PageHeader'
import { Table, type Column } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { LoanStatusBadge } from '@/components/common/StatusBadge'
import { useAuth } from '@/hooks/useAuth'
import { Permission } from '@/types/enums'
import { formatDate } from '@/utils/format'
import type { Loan } from '@/types/models'

export default function MyLoansPage() {
  const { hasPermission } = useAuth()
  const [loans, setLoans] = useState<Loan[]>([])
  const [bookTitleById, setBookTitleById] = useState<Map<string, string>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyLoanId, setBusyLoanId] = useState<string | null>(null)
  const [returnTarget, setReturnTarget] = useState<Loan | null>(null)

  const canRenew = hasPermission(Permission.RENEW_LOANS)

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    Promise.all([getMyLoans(), getBooks()])
      .then(([loanResult, books]) => {
        setLoans(loanResult)
        setBookTitleById(new Map(books.map((b) => [b.id, b.title])))
      })
      .catch((err) => setError(getErrorMessage(err, 'Unable to load your loans.')))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleReturn() {
    if (!returnTarget) return
    setBusyLoanId(returnTarget.id)
    try {
      await returnLoan(returnTarget.id)
      toast.success('Book returned. Thanks!')
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
            {loan.status !== 'RETURNED' && canRenew && (
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

  return (
    <div>
      <PageHeader title="My Loans" description="Books you currently have, or have borrowed in the past." />
      {loans.length === 0 ? (
        <EmptyState icon={Library} title="No loans yet" description="Books you borrow will show up here." />
      ) : (
        <Table columns={columns} data={loans} rowKey={(loan) => loan.id} />
      )}

      <ConfirmDialog
        open={Boolean(returnTarget)}
        title="Return this book?"
        description={`Return "${returnTarget ? bookTitleById.get(returnTarget.bookId) ?? 'this book' : ''}"? This will free up a copy for other members.`}
        confirmLabel="Return"
        isLoading={Boolean(busyLoanId) && busyLoanId === returnTarget?.id}
        onConfirm={handleReturn}
        onCancel={() => setReturnTarget(null)}
      />
    </div>
  )
}
