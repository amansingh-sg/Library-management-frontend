import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { CalendarClock, PackageCheck, Search } from 'lucide-react'
import {
  cancelReservation,
  fulfillReservation,
  getAllReservations,
  type ReservationSortBy,
  type SortOrder,
} from '@/api/reservations.api'
import { getBooks } from '@/api/books.api'
import { getUsers } from '@/api/admin.api'
import { getErrorMessage } from '@/api/client'
import { useDebounce } from '@/hooks/useDebounce'
import { PageHeader } from '@/components/member/PageHeader'
import { Table, type Column } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { StatusPills } from '@/components/ui/StatusPills'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { ReservationStatusBadge } from '@/components/common/StatusBadge'
import { useAuth } from '@/hooks/useAuth'
import { Permission, ReservationStatus } from '@/types/enums'
import { formatDate, formatDateTime } from '@/utils/format'
import type { AdminUser, PaginatedResponse, Reservation } from '@/types/models'

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

// Staff-facing view of every reservation in the library (not just the current
// user's own). STAFF can view only; LIBRARIAN and above can mark a ready
// reservation as collected or cancel one. On mount it loads the current page of
// reservations plus the full book and user lists used as lookup maps for the table.
export default function ReservationsManagementPage() {
  const { hasPermission } = useAuth()
  // STAFF sees this page read-only (VIEW_ALL_RESERVATIONS, no action permissions) -
  // LIBRARIAN+ holds MANAGE_RESERVATIONS and can act on any reservation.
  const canManageReservations = hasPermission(Permission.MANAGE_RESERVATIONS)
  const [page, setPage] = useState<PaginatedResponse<Reservation> | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [sortValue, setSortValue] = useState(SORT_OPTIONS[0].value)
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | ''>('')
  const [bookTitleById, setBookTitleById] = useState<Map<string, string>>(new Map())
  const [userById, setUserById] = useState<Map<string, AdminUser>>(new Map())
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null)

  const reservations = page?.data ?? []
  const activeSort = SORT_OPTIONS.find((o) => o.value === sortValue) ?? SORT_OPTIONS[0]
  const debouncedSearch = useDebounce(search, 500)

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    // Books/users are fetched in full here (not paginated) — they're lookup maps for
    // rendering titles/member names, not the list this page paginates.
    // getUsers requires MANAGE_USERS/MANAGE_MEMBERS, which STAFF doesn't hold (they
    // only get read-only VIEW_ALL_RESERVATIONS) - fall back to an empty map on 403
    // rather than letting it fail the whole page (reserverLabel below already falls
    // back to the raw userId when a name can't be resolved).
    //
    // Search runs server-side against every reservation (see getAllReservations) -
    // it used to only filter whichever page of results happened to already be
    // loaded, which silently missed matches sitting on a page that hadn't been
    // fetched yet.
    Promise.all([
      getAllReservations({
        page: pageNumber,
        sortBy: activeSort.sortBy,
        sortOrder: activeSort.sortOrder,
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
      }),
      getBooks({}, { perPage: 500 }),
      getUsers({ perPage: 500 }).catch(() => ({ data: [] as AdminUser[] })),
    ])
      .then(([reservationResult, books, users]) => {
        setPage(reservationResult)
        setBookTitleById(new Map(books.data.map((b) => [b.id, b.title])))
        setUserById(new Map(users.data.map((u) => [u.id, u])))
      })
      .catch((err) => setError(getErrorMessage(err, 'Unable to load reservations.')))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, sortValue, statusFilter, debouncedSearch])

  useEffect(() => {
    setPageNumber(1)
  }, [sortValue, statusFilter, debouncedSearch])

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
      toast.success('Marked as collected.')
      load()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to mark this reservation as collected.'))
    } finally {
      setBusyId(null)
    }
  }

  function reserverLabel(userId: string): string {
    const user = userById.get(userId)
    if (!user) return userId
    return `${user.firstName} ${user.lastName} (${user.email})`
  }

  const columns = useMemo<Column<Reservation>[]>(
    () => [
      { header: 'Member', accessor: (r) => reserverLabel(r.userId) },
      { header: 'Book', accessor: (r) => bookTitleById.get(r.bookId) ?? r.bookId },
      { header: 'Reserved', accessor: (r) => formatDate(r.reservedAt) },
      { header: 'Status', accessor: (r) => <ReservationStatusBadge status={r.status} /> },
      {
        header: 'Ready / Expiry',
        accessor: (r) =>
          r.status === ReservationStatus.READY && r.expiresAt ? formatDateTime(r.expiresAt) : '—',
      },
      ...(canManageReservations
        ? [
            {
              header: 'Actions',
              accessor: (r: Reservation) => (
                <div className="flex items-center gap-2">
                  {r.status === ReservationStatus.READY && (
                    <Button size="sm" onClick={() => handleFulfill(r)} isLoading={busyId === r.id}>
                      <PackageCheck className="size-3.5" />
                      Mark collected
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
          ]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookTitleById, userById, canManageReservations, busyId],
  )

  return (
    <div>
      <PageHeader title="Reservations" description="Every reservation across all members, and where it stands." />

      <div className="mb-4">
        <StatusPills options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="max-w-xs flex-1">
          <Input
            placeholder="Search by member or book"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            name="reservation-search"
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
        <SkeletonTable rows={8} cols={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : reservations.length === 0 ? (
        search || statusFilter ? (
          <EmptyState
            icon={Search}
            title="No matching reservations"
            description="Try a different search term or filter."
          />
        ) : (
          <EmptyState
            icon={CalendarClock}
            title="No reservations yet"
            description="Reservations members make will show up here."
          />
        )
      ) : (
        <>
          <Table columns={columns} data={reservations} rowKey={(r) => r.id} />
          {page && <Pagination page={page} onPageChange={setPageNumber} isLoading={isLoading} />}
        </>
      )}

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel this reservation?"
        description={`Cancel ${cancelTarget ? reserverLabel(cancelTarget.userId) : ''}'s reservation for "${cancelTarget ? bookTitleById.get(cancelTarget.bookId) ?? 'this book' : ''}"?`}
        confirmLabel="Cancel reservation"
        danger
        isLoading={Boolean(busyId) && busyId === cancelTarget?.id}
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  )
}
