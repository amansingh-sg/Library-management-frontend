import { useCallback, useEffect, useMemo, useState } from 'react'
import { Heart, Search } from 'lucide-react'
import { getAllFavourites } from '@/api/favourites.api'
import { getBooks } from '@/api/books.api'
import { getUsers } from '@/api/admin.api'
import { getErrorMessage } from '@/api/client'
import type { PaginatedResponse } from '@/types/models'
import { PageHeader } from '@/components/member/PageHeader'
import { Table, type Column } from '@/components/ui/Table'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { Role } from '@/types/enums'
import type { AdminUser, Book, Favourite } from '@/types/models'

const PAGE_SIZE = 15

interface BookFavourites {
  bookId: string
  title: string
  count: number
  members: AdminUser[]
}

type FavouriteSortValue = 'count-desc' | 'count-asc' | 'title-asc'

const SORT_OPTIONS: { value: FavouriteSortValue; label: string }[] = [
  { value: 'count-desc', label: 'Most favourited' },
  { value: 'count-asc', label: 'Least favourited' },
  { value: 'title-asc', label: 'Title (A–Z)' },
]

// The backend caps per_page at 500 (server-side validation), so grouping "which
// members favourited this book" - which needs the complete set, not one page at a
// time - has to page through the results rather than requesting them all at once.
async function getAllFavouritesUnpaged(): Promise<Favourite[]> {
  const perPage = 500
  const first = await getAllFavourites({ page: 1, perPage })
  const pages = [first.data]

  for (let page = 2; page <= first.last_page; page += 1) {
    const next: PaginatedResponse<Favourite> = await getAllFavourites({ page, perPage })
    pages.push(next.data)
  }

  return pages.flat()
}

export default function FavouritesManagementPage() {
  const [favourites, setFavourites] = useState<Favourite[]>([])
  const [bookById, setBookById] = useState<Map<string, Book>>(new Map())
  const [userById, setUserById] = useState<Map<string, AdminUser>>(new Map())
  const [search, setSearch] = useState('')
  const [sortValue, setSortValue] = useState<FavouriteSortValue>('count-desc')
  const [pageNumber, setPageNumber] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    // Favourites, books and users are all fetched in full here - grouping "which
    // members favourited this book" only works with the complete set, not one page
    // of favourite rows at a time.
    // getUsers requires MANAGE_USERS/MANAGE_MEMBERS, which STAFF doesn't hold (they
    // only get read-only VIEW_ALL_FAVOURITES) - fall back to an empty map on 403
    // rather than letting it fail the whole page; bookFavourites below still groups
    // correctly without resolved names (see the fallback there).
    Promise.all([
      getAllFavouritesUnpaged(),
      getBooks({}, { perPage: 500 }),
      getUsers({ perPage: 500 }).catch(() => ({ data: [] as AdminUser[] })),
    ])
      .then(([favouriteRows, bookResult, userResult]) => {
        setFavourites(favouriteRows)
        setBookById(new Map(bookResult.data.map((b) => [b.id, b])))
        setUserById(new Map(userResult.data.map((u) => [u.id, u])))
      })
      .catch((err) => setError(getErrorMessage(err, 'Unable to load favourites.')))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const bookFavourites = useMemo<BookFavourites[]>(() => {
    // Seeded from the FULL catalogue (bookById, fetched separately below), not just
    // the books that happen to have a favourite row - a book nobody has ever
    // favourited has no row in `favourites` to group, so building this map by only
    // iterating favourites would silently drop it from the list entirely (it could
    // never appear, under any sort, not just rank low under "Least favourited").
    // Every book starts at a real 0 here, then gets filled in from the actual rows.
    const grouped = new Map<string, AdminUser[]>()
    bookById.forEach((_book, bookId) => grouped.set(bookId, []))

    favourites.forEach((favourite) => {
      // Falls back to a placeholder when the member's name couldn't be resolved
      // (e.g. a STAFF viewer, who can see this page but not the user directory) -
      // the count and grouping still work correctly, just without a real name.
      const user = userById.get(favourite.userId) ?? {
        id: favourite.userId,
        email: favourite.userId,
        firstName: 'Member',
        lastName: '',
        dob: '',
        isVerified: true,
        role: Role.MEMBER,
      }
      const list = grouped.get(favourite.bookId) ?? []
      list.push(user)
      grouped.set(favourite.bookId, list)
    })

    const rows = Array.from(grouped.entries()).map(([bookId, members]) => ({
      bookId,
      title: bookById.get(bookId)?.title ?? bookId,
      count: members.length,
      members,
    }))

    if (sortValue === 'count-asc') return rows.sort((a, b) => a.count - b.count)
    if (sortValue === 'title-asc') return rows.sort((a, b) => a.title.localeCompare(b.title))
    return rows.sort((a, b) => b.count - a.count)
  }, [favourites, bookById, userById, sortValue])

  const filteredBookFavourites = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return bookFavourites
    return bookFavourites.filter((row) => {
      if (row.title.toLowerCase().includes(term)) return true
      return row.members.some(
        (member) =>
          member.email.toLowerCase().includes(term) ||
          `${member.firstName} ${member.lastName}`.toLowerCase().includes(term),
      )
    })
  }, [bookFavourites, search])

  // This page groups raw favourite rows by book (see bookFavourites above), so the
  // backend's own pagination doesn't apply to the grouped result - paginate the
  // grouped+filtered rows client-side instead, in the same PaginatedResponse shape
  // the shared <Pagination> component expects.
  useEffect(() => {
    setPageNumber(1)
  }, [search, sortValue])

  const totalRows = filteredBookFavourites.length
  const lastPage = Math.max(1, Math.ceil(totalRows / PAGE_SIZE))
  const currentPage = Math.min(pageNumber, lastPage)
  const pagedBookFavourites = filteredBookFavourites.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )
  const paginationInfo = {
    data: pagedBookFavourites,
    total: totalRows,
    per_page: PAGE_SIZE,
    current_page: currentPage,
    last_page: lastPage,
    from: totalRows === 0 ? null : (currentPage - 1) * PAGE_SIZE + 1,
    to: totalRows === 0 ? null : Math.min(currentPage * PAGE_SIZE, totalRows),
    prev_page: currentPage > 1 ? currentPage - 1 : null,
    next_page: currentPage < lastPage ? currentPage + 1 : null,
  }

  const columns: Column<BookFavourites>[] = [
    { header: 'Book', accessor: (row) => row.title },
    {
      header: 'Favourite count',
      accessor: (row) => <Badge tone={row.count > 0 ? 'purple' : 'slate'}>{row.count}</Badge>,
    },
    {
      header: 'Favourited by',
      accessor: (row) =>
        row.members.length === 0 ? (
          <span className="text-slate-400">No one yet</span>
        ) : (
          <div className="flex max-w-md flex-wrap items-center gap-x-1.5 gap-y-1">
            {row.members.map((member, index) => (
              <span key={member.id} className="text-slate-700">
                <span title={member.email}>
                  {member.firstName} {member.lastName}
                </span>
                {index < row.members.length - 1 && <span className="text-slate-400">,</span>}
              </span>
            ))}
          </div>
        ),
      className: 'whitespace-normal',
    },
  ]

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Favourites" description="Which books members love, and who's favourited them." />
        <SkeletonTable rows={8} cols={3} />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Favourites" />
        <ErrorState message={error} onRetry={load} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Favourites" description="Which books members love, and who's favourited them." />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="max-w-xs flex-1">
          <Input
            placeholder="Search by book or member"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            name="favourite-search"
          />
        </div>
        <div className="w-56">
          <Select
            label="Sort by"
            value={sortValue}
            onChange={(e) => setSortValue(e.target.value as FavouriteSortValue)}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {bookFavourites.length === 0 ? (
        <EmptyState icon={Heart} title="No favourites yet" description="Books members favourite will show up here." />
      ) : filteredBookFavourites.length === 0 ? (
        <EmptyState icon={Search} title="No matching favourites" description="Try a different search term." />
      ) : (
        <>
          <Table columns={columns} data={pagedBookFavourites} rowKey={(row) => row.bookId} />
          <Pagination page={paginationInfo} onPageChange={setPageNumber} isLoading={isLoading} />
        </>
      )}
    </div>
  )
}
