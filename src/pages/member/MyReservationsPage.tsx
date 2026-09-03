import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { CalendarClock, PackageCheck } from 'lucide-react'
import {
  cancelReservation,
  fulfillReservation,
  getMyReservations,
  type ReservationSortBy,
  type SortOrder,
} from '@/api/reservations.api'
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
import { ReservationStatusBadge } from '@/components/common/StatusBadge'
import { ReservationStatus } from '@/types/enums'
import { formatDate, formatDateTime } from '@/utils/format'
import type { PaginatedResponse, Reservation } from '@/types/models'

function expiryHint(reservation: Reservation): string | null {
  if (reservation.status !== ReservationStatus.READY || !reservation.expiresAt) return null
  const diffMs = new Date(reservation.expiresAt).getTime() - Date.now()
  if (diffMs <= 0) return 'Expired'
  const hours = Math.round(diffMs / (1000 * 60 * 60))
  return hours <= 1 ? 'Expires soon' : `Expires in ~${hours}h`
}

interface SortOption {
  value: string
  label: string
  sortBy: ReservationSortBy
  sortOrder: SortOrder
}

const SORT_OPTIONS: SortOption[] = [
  { value: 'reservedAt-desc', label: 'Newest reservations first', sortBy: 'reservedAt', sortOrder: 'DESC' },
  { value: 'reservedAt-asc', label: 'Oldest reservations first', sortBy: 'reservedAt', sortOrder: 'ASC' },
  { value: 'status-asc', label: 'Group by status', sortBy: 'status', sortOrder: 'ASC' },
]

const STATUS_OPTIONS: { value: ReservationStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: ReservationStatus.WAITING, label: 'Waiting' },
  { value: ReservationStatus.READY, label: 'Ready' },
  { value: ReservationStatus.FULFILLED, label: 'Fulfilled' },
  { value: ReservationStatus.CANCELLED, label: 'Cancelled' },
  { value: ReservationStatus.EXPIRED, label: 'Expired' },
]

// Paginated list of the current member's reservations. Lets them collect a book
// once it's READY, or cancel a reservation while it's still waiting or ready.
export default function MyReservationsPage() {
  const [page, setPage] = useState<PaginatedResponse<Reservation> | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [sortValue, setSortValue] = useState(SORT_OPTIONS[0].value)
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | ''>('')
  const [bookTitleById, setBookTitleById] = useState<Map<string, string>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null)

  const reservations = page?.data ?? []
  const activeSort = SORT_OPTIONS.find((o) => o.value === sortValue) ?? SORT_OPTIONS[0]

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    // Books are fetched in full here (not paginated) — it's a title lookup map, not the
    // list this page paginates.
    Promise.all([
      getMyReservations({
        page: pageNumber,
        sortBy: activeSort.sortBy,
        sortOrder: activeSort.sortOrder,
        status: statusFilter || undefined,
      }),
      getBooks({}, { perPage: 500 }),
    ])
      .then(([reservationResult, books]) => {
        setPage(reservationResult)
        setBookTitleById(new Map(books.data.map((b) => [b.id, b.title])))
      })
      .catch((err) => setError(getErrorMessage(err, 'Unable to load your reservations.')))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, sortValue, statusFilter])

  useEffect(() => {
    setPageNumber(1)
  }, [sortValue, statusFilter])

  useEffect(() => {
    load()
  }, [load])

  async function handleCancel() {
    if (!cancelTarget) return
    setBusyId(cancelTarget.id)
    try {
      await cancelReservation(cancelTarget.id)
      toast.success('Reservation cancelled.')
      setCancelTarget(null)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to cancel this reservation.'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleFulfill(reservation: Reservation) {
    setBusyId(reservation.id)
    try {
      await fulfillReservation(reservation.id)
      toast.success('Collected! Check My Loans for the due date.')
      load()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to collect this reservation.'))
    } finally {
      setBusyId(null)
    }
  }

  const columns = useMemo<Column<Reservation>[]>(
    () => [
      { header: 'Book', accessor: (r) => bookTitleById.get(r.bookId) ?? r.bookId },
      { header: 'Reserved', accessor: (r) => formatDate(r.reservedAt) },
      { header: 'Status', accessor: (r) => <ReservationStatusBadge status={r.status} /> },
      {
        header: 'Ready / Expiry',
        accessor: (r) =>
          r.status === ReservationStatus.READY ? (
            <div>
              <p>{formatDateTime(r.expiresAt)}</p>
              <p className="text-xs text-amber-600">{expiryHint(r)}</p>
            </div>
          ) : (
            '—'
          ),
      },
      {
        header: 'Actions',
        accessor: (r) => (
          <div className="flex items-center gap-2">
            {r.status === ReservationStatus.READY && (
              <Button size="sm" onClick={() => handleFulfill(r)} isLoading={busyId === r.id}>
                <PackageCheck className="size-3.5" />
                Collect
              </Button>
            )}
            {(r.status === ReservationStatus.WAITING || r.status === ReservationStatus.READY) && (
              <Button size="sm" variant="outline" onClick={() => setCancelTarget(r)}>
                Cancel
              </Button>
            )}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookTitleById, busyId],
  )

  if (isLoading) {
    return (
      <div>
        <PageHeader title="My Reservations" description="Books you're waiting on, or ready to collect." />
        <SkeletonTable rows={4} cols={5} />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <PageHeader title="My Reservations" />
        <ErrorState message={error} onRetry={load} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="My Reservations" description="Books you're waiting on, or ready to collect." />

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

      {reservations.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No reservations"
          description="Reserve a book that's currently unavailable and it will show up here once it's your turn."
        />
      ) : (
        <>
          <Table columns={columns} data={reservations} rowKey={(r) => r.id} />
          {page && <Pagination page={page} onPageChange={setPageNumber} isLoading={isLoading} />}
        </>
      )}

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel this reservation?"
        description={`Cancel your reservation for "${cancelTarget ? bookTitleById.get(cancelTarget.bookId) ?? 'this book' : ''}"? You'll lose your place in the queue.`}
        confirmLabel="Cancel reservation"
        danger
        isLoading={Boolean(busyId) && busyId === cancelTarget?.id}
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  )
}
