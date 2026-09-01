import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, Search } from 'lucide-react'
import { getAllReservations } from '@/api/reservations.api'
import { getBooks } from '@/api/books.api'
import { getUsers } from '@/api/admin.api'
import { getErrorMessage } from '@/api/client'
import { PageHeader } from '@/components/member/PageHeader'
import { Table, type Column } from '@/components/ui/Table'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { ReservationStatusBadge } from '@/components/common/StatusBadge'
import { ReservationStatus } from '@/types/enums'
import { formatDate, formatDateTime } from '@/utils/format'
import type { AdminUser, PaginatedResponse, Reservation } from '@/types/models'

export default function ReservationsManagementPage() {
  const [page, setPage] = useState<PaginatedResponse<Reservation> | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [bookTitleById, setBookTitleById] = useState<Map<string, string>>(new Map())
  const [userById, setUserById] = useState<Map<string, AdminUser>>(new Map())
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reservations = page?.data ?? []

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    // Books/users are fetched in full here (not paginated) — they're lookup maps for
    // rendering titles/member names, not the list this page paginates.
    Promise.all([
      getAllReservations({ page: pageNumber }),
      getBooks({}, { perPage: 500 }),
      getUsers({ perPage: 500 }),
    ])
      .then(([reservationResult, books, users]) => {
        setPage(reservationResult)
        setBookTitleById(new Map(books.data.map((b) => [b.id, b.title])))
        setUserById(new Map(users.data.map((u) => [u.id, u])))
      })
      .catch((err) => setError(getErrorMessage(err, 'Unable to load reservations.')))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber])

  useEffect(() => {
    load()
  }, [load])

  function reserverLabel(userId: string): string {
    const user = userById.get(userId)
    if (!user) return userId
    return `${user.firstName} ${user.lastName} (${user.email})`
  }

  const filteredReservations = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return reservations
    return reservations.filter((r) => {
      const reserver = reserverLabel(r.userId).toLowerCase()
      const title = (bookTitleById.get(r.bookId) ?? '').toLowerCase()
      return reserver.includes(term) || title.includes(term)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservations, search, userById, bookTitleById])

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
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookTitleById, userById],
  )

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Reservations" description="Every reservation across all members, and where it stands." />
        <SkeletonTable rows={8} cols={5} />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Reservations" />
        <ErrorState message={error} onRetry={load} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Reservations" description="Every reservation across all members, and where it stands." />

      <div className="mb-4 max-w-xs">
        <Input
          placeholder="Search this page by member or book"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          name="reservation-search"
        />
      </div>

      {reservations.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No reservations yet"
          description="Reservations members make will show up here."
        />
      ) : filteredReservations.length === 0 ? (
        <EmptyState icon={Search} title="No matching reservations" description="Try a different search term." />
      ) : (
        <>
          <Table columns={columns} data={filteredReservations} rowKey={(r) => r.id} />
          {page && <Pagination page={page} onPageChange={setPageNumber} isLoading={isLoading} />}
        </>
      )}
    </div>
  )
}
