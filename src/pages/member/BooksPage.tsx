import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, PackagePlus, Plus, Search, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { getBooks, createBook, deleteBook, addBookCopies, type BookSortBy, type SortOrder } from '@/api/books.api'
import { getAuthors, createAuthor } from '@/api/authors.api'
import { getMyFavourites, addFavourite, removeFavourite } from '@/api/favourites.api'
import { getErrorMessage } from '@/api/client'
import { PageHeader } from '@/components/member/PageHeader'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Combobox } from '@/components/ui/Combobox'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Table, type Column } from '@/components/ui/Table'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Pagination } from '@/components/ui/Pagination'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAuth } from '@/hooks/useAuth'
import { useDebounce } from '@/hooks/useDebounce'
import { Permission, Role } from '@/types/enums'
import { SEED_CATEGORIES, getCategoryName } from '@/types/seed-categories'
import { cn } from '@/utils/cn'
import type { Author, Book, PaginatedResponse } from '@/types/models'

const EMPTY_NEW_BOOK = {
  title: '',
  isbn: '',
  authorId: '',
  categoryId: '',
  publishedYear: '',
  totalCopies: '1',
}

interface SortOption {
  value: string
  label: string
  sortBy: BookSortBy
  sortOrder: SortOrder
}

const SORT_OPTIONS: SortOption[] = [
  { value: 'title-asc', label: 'Title (A–Z)', sortBy: 'title', sortOrder: 'ASC' },
  { value: 'title-desc', label: 'Title (Z–A)', sortBy: 'title', sortOrder: 'DESC' },
  { value: 'publishedYear-desc', label: 'Publication year (newest)', sortBy: 'publishedYear', sortOrder: 'DESC' },
  { value: 'publishedYear-asc', label: 'Publication year (oldest)', sortBy: 'publishedYear', sortOrder: 'ASC' },
  { value: 'availableCopies-desc', label: 'Most available copies', sortBy: 'availableCopies', sortOrder: 'DESC' },
  { value: 'availableCopies-asc', label: 'Fewest available copies', sortBy: 'availableCopies', sortOrder: 'ASC' },
]

// Book catalogue, browsable by everyone. Staff/librarians/admins with MANAGE_BOOKS
// also get add/restock/delete actions here; members get a favourite toggle instead.
export default function BooksPage() {
  const { hasPermission, hasRole } = useAuth()
  const canManageBooks = hasPermission(Permission.MANAGE_BOOKS)
  // Favouriting is a patron action - staff, librarians, and admins don't get a heart
  // button at all (matches the backend's role check in FavouriteService.addFavourite).
  const canFavourite = hasRole(Role.MEMBER)

  const [page, setPage] = useState<PaginatedResponse<Book> | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [authors, setAuthors] = useState<Author[]>([])
  const [favouriteBookIds, setFavouriteBookIds] = useState<Set<string>>(new Set())
  const [busyFavouriteId, setBusyFavouriteId] = useState<string | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [newBook, setNewBook] = useState(EMPTY_NEW_BOOK)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Set while the "Add <name> as a new author" flow from the Combobox is waiting on
  // an optional bio before it actually creates the author - resolve/reject settle the
  // promise the Combobox's onCreate handed back, so it can finish (or cancel) the pick.
  const [pendingAuthorName, setPendingAuthorName] = useState<string | null>(null)
  const [pendingAuthorBio, setPendingAuthorBio] = useState('')
  const [isCreatingAuthor, setIsCreatingAuthor] = useState(false)
  const pendingAuthorResolvers = useRef<{
    resolve: (option: { value: string; label: string }) => void
    reject: (err: unknown) => void
  } | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null)

  const [restockTarget, setRestockTarget] = useState<Book | null>(null)
  const [restockCount, setRestockCount] = useState('1')
  const [isRestocking, setIsRestocking] = useState(false)
  const [restockError, setRestockError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sortValue, setSortValue] = useState(SORT_OPTIONS[0].value)

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const books = page?.data ?? []

  // 500ms debounce so a search request isn't fired on every keystroke - only once
  // typing pauses.
  const debouncedSearch = useDebounce(search, 500)

  const authorNameById = useMemo(() => new Map(authors.map((a) => [a.id, a.name])), [authors])

  useEffect(() => {
    getAuthors()
      .then(setAuthors)
      .catch(() => setAuthors([]))
    // This is a lookup set (which books am I favouriting), not a paged list.
    getMyFavourites({ perPage: 500 })
      .then(({ data }) => setFavouriteBookIds(new Set(data.map((f) => f.bookId))))
      .catch(() => setFavouriteBookIds(new Set()))
  }, [])

  const activeSort = SORT_OPTIONS.find((o) => o.value === sortValue) ?? SORT_OPTIONS[0]

  // A filter or sort change should always land back on page 1 - staying on e.g. page 3
  // of a now much-smaller (or differently ordered) result set would just show an
  // empty or confusing page.
  useEffect(() => {
    setPageNumber(1)
  }, [debouncedSearch, categoryFilter, sortValue])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    getBooks(
      {
        search: debouncedSearch || undefined,
        category: categoryFilter || undefined,
        sortBy: activeSort.sortBy,
        sortOrder: activeSort.sortOrder,
      },
      { page: pageNumber },
    )
      .then((result) => {
        if (!cancelled) setPage(result)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Unable to load books.'))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, categoryFilter, sortValue, pageNumber, reloadToken])

  async function handleToggleFavourite(book: Book) {
    const isFav = favouriteBookIds.has(book.id)
    setBusyFavouriteId(book.id)
    try {
      if (isFav) {
        await removeFavourite(book.id)
        setFavouriteBookIds((prev) => {
          const next = new Set(prev)
          next.delete(book.id)
          return next
        })
        toast.success('Removed from favourites')
      } else {
        await addFavourite(book.id)
        setFavouriteBookIds((prev) => new Set(prev).add(book.id))
        toast.success('Added to favourites')
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to update favourites.'))
    } finally {
      setBusyFavouriteId(null)
    }
  }

  function openAddModal() {
    setNewBook(EMPTY_NEW_BOOK)
    setCreateError(null)
    setAddOpen(true)
  }

  async function submitPendingAuthor(bio?: string) {
    if (!pendingAuthorName || !pendingAuthorResolvers.current) return
    const resolvers = pendingAuthorResolvers.current

    setIsCreatingAuthor(true)
    try {
      const author = await createAuthor(pendingAuthorName, bio)
      setAuthors((prev) => [...prev, author].sort((a, b) => a.name.localeCompare(b.name)))
      toast.success(`"${author.name}" added as a new author.`)
      resolvers.resolve({ value: author.id, label: author.name })
      setPendingAuthorName(null)
      pendingAuthorResolvers.current = null
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to add this author.'))
      resolvers.reject(err)
      setPendingAuthorName(null)
      pendingAuthorResolvers.current = null
    } finally {
      setIsCreatingAuthor(false)
    }
  }

  function handleCancelPendingAuthor() {
    // Combobox swallows a rejected onCreate itself (dropdown just stays open), so this
    // just needs to unblock the promise, not surface an error toast.
    pendingAuthorResolvers.current?.reject(new Error('Author creation cancelled'))
    pendingAuthorResolvers.current = null
    setPendingAuthorName(null)
  }

  async function handleCreateBook() {
    setCreateError(null)

    const totalCopies = Number(newBook.totalCopies)
    if (!newBook.title.trim() || !newBook.isbn.trim() || !newBook.authorId || !newBook.categoryId) {
      setCreateError('Title, ISBN, author, and category are all required.')
      return
    }
    if (!Number.isInteger(totalCopies) || totalCopies < 1) {
      setCreateError('Total copies must be a whole number of at least 1.')
      return
    }

    setIsCreating(true)
    try {
      await createBook({
        title: newBook.title.trim(),
        isbn: newBook.isbn.trim(),
        authorId: newBook.authorId,
        categoryId: newBook.categoryId,
        totalCopies,
        publishedYear: newBook.publishedYear ? Number(newBook.publishedYear) : undefined,
      })
      toast.success('Book added to the catalogue.')
      setAddOpen(false)
      setReloadToken((t) => t + 1)
    } catch (err) {
      setCreateError(getErrorMessage(err, 'Unable to add this book.'))
    } finally {
      setIsCreating(false)
    }
  }

  function openRestockModal(book: Book) {
    setRestockTarget(book)
    setRestockCount('1')
    setRestockError(null)
  }

  async function handleRestock() {
    if (!restockTarget) return
    const count = Number(restockCount)
    if (!Number.isInteger(count) || count < 1) {
      setRestockError('Enter a whole number of at least 1.')
      return
    }

    setIsRestocking(true)
    setRestockError(null)
    try {
      await addBookCopies(restockTarget.id, count)
      toast.success(`Added ${count} ${count === 1 ? 'copy' : 'copies'} of "${restockTarget.title}".`)
      setRestockTarget(null)
      setReloadToken((t) => t + 1)
    } catch (err) {
      setRestockError(getErrorMessage(err, 'Unable to add copies.'))
    } finally {
      setIsRestocking(false)
    }
  }

  async function handleDeleteBook() {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteBook(deleteTarget.id)
      toast.success(`"${deleteTarget.title}" was removed from the catalogue.`)
      setDeleteTarget(null)
      setReloadToken((t) => t + 1)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to delete this book.'))
    } finally {
      setIsDeleting(false)
    }
  }

  const hasFilters = Boolean(search || categoryFilter || sortValue !== SORT_OPTIONS[0].value)

  const columns: Column<Book>[] = [
    {
      header: 'Title',
      accessor: (book) => (
        <Link to={`/books/${book.id}`} className="font-medium text-slate-900 hover:text-brand-600">
          {book.title}
        </Link>
      ),
      className: 'whitespace-normal',
    },
    { header: 'Author', accessor: (book) => authorNameById.get(book.authorId) ?? 'Unknown author' },
    {
      header: 'Category',
      accessor: (book) => <Badge tone="slate">{getCategoryName(book.categoryId)}</Badge>,
    },
    { header: 'Published', accessor: (book) => book.publishedYear ?? '—' },
    {
      header: 'Availability',
      accessor: (book) => (
        <Badge tone={book.availableCopies > 0 ? 'green' : 'red'}>
          {book.availableCopies > 0 ? `${book.availableCopies} of ${book.totalCopies} available` : 'Unavailable'}
        </Badge>
      ),
    },
    {
      header: '',
      className: 'text-right',
      accessor: (book) => {
        const isFavourite = favouriteBookIds.has(book.id)
        return (
          <div className="flex items-center justify-end gap-1">
            {canFavourite && (
              <button
                type="button"
                onClick={() => handleToggleFavourite(book)}
                disabled={busyFavouriteId === book.id}
                aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
                className="inline-flex size-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-red-500 disabled:opacity-50"
              >
                <Heart className={cn('size-4', isFavourite && 'fill-red-500 text-red-500')} />
              </button>
            )}
            {canManageBooks && (
              <button
                type="button"
                onClick={() => openRestockModal(book)}
                aria-label="Add copies"
                className="inline-flex size-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-brand-600"
              >
                <PackagePlus className="size-4" />
              </button>
            )}
            {canManageBooks && (
              <button
                type="button"
                onClick={() => setDeleteTarget(book)}
                aria-label="Delete book"
                className="inline-flex size-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-red-600"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title="Books"
        description="Browse the library catalogue."
        action={
          canManageBooks && (
            <Button onClick={openAddModal}>
              <Plus className="size-4" />
              Add book
            </Button>
          )
        }
      />

      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            label="Search"
            placeholder="Search by title or author…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <Select
            label="Category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {SEED_CATEGORIES.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex-1">
          <Select
            label="Sort by"
            value={sortValue}
            onChange={(e) => setSortValue(e.target.value)}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            size="md"
            onClick={() => {
              setSearch('')
              setCategoryFilter('')
              setSortValue(SORT_OPTIONS[0].value)
            }}
          >
            <X className="size-4" />
            Clear
          </Button>
        )}
      </div>

      {isLoading && <SkeletonTable rows={8} cols={6} />}

      {!isLoading && error && <ErrorState message={error} onRetry={() => setReloadToken((t) => t + 1)} />}

      {!isLoading && !error && books.length === 0 && (
        <EmptyState
          icon={Search}
          title="No books found"
          description="Try adjusting your search or filters."
        />
      )}

      {!isLoading && !error && books.length > 0 && (
        <>
          <Table columns={columns} data={books} rowKey={(book) => book.id} />
          {page && <Pagination page={page} onPageChange={setPageNumber} isLoading={isLoading} />}
        </>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add a book"
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleCreateBook} isLoading={isCreating}>
              Add book
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Title"
            value={newBook.title}
            onChange={(e) => setNewBook((b) => ({ ...b, title: e.target.value }))}
          />
          <Input
            label="ISBN"
            value={newBook.isbn}
            onChange={(e) => setNewBook((b) => ({ ...b, isbn: e.target.value }))}
          />
          <Combobox
            label="Author"
            placeholder="Search authors…"
            value={newBook.authorId}
            onChange={(authorId) => setNewBook((b) => ({ ...b, authorId }))}
            options={authors.map((author) => ({ value: author.id, label: author.name }))}
            emptyMessage="No authors found"
            createLabel={(query) => `Add "${query}" as a new author`}
            onCreate={(query) =>
              // Held open until the bio prompt below resolves or is skipped/cancelled -
              // see handleConfirmCreateAuthor / handleSkipAuthorBio.
              new Promise((resolve, reject) => {
                pendingAuthorResolvers.current = { resolve, reject }
                setPendingAuthorBio('')
                setPendingAuthorName(query)
              })
            }
          />
          <Select
            label="Category"
            value={newBook.categoryId}
            onChange={(e) => setNewBook((b) => ({ ...b, categoryId: e.target.value }))}
          >
            <option value="">Select a category…</option>
            {SEED_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Published year"
              type="number"
              value={newBook.publishedYear}
              onChange={(e) => setNewBook((b) => ({ ...b, publishedYear: e.target.value }))}
            />
            <Input
              label="Total copies"
              type="number"
              min={1}
              value={newBook.totalCopies}
              onChange={(e) => setNewBook((b) => ({ ...b, totalCopies: e.target.value }))}
            />
          </div>
          {createError && <p className="text-sm text-red-600">{createError}</p>}
        </div>
      </Modal>

      <Modal
        open={pendingAuthorName !== null}
        onClose={handleCancelPendingAuthor}
        title={`Add "${pendingAuthorName ?? ''}" as a new author`}
        footer={
          <>
            <Button variant="outline" onClick={() => submitPendingAuthor()} isLoading={isCreatingAuthor}>
              Skip bio
            </Button>
            <Button onClick={() => submitPendingAuthor(pendingAuthorBio)} isLoading={isCreatingAuthor}>
              Add author
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Bio (optional)</label>
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            rows={4}
            placeholder="A short note about this author…"
            value={pendingAuthorBio}
            onChange={(e) => setPendingAuthorBio(e.target.value)}
          />
          <p className="text-xs text-slate-400">You can leave this blank and add a bio later.</p>
        </div>
      </Modal>

      <Modal
        open={restockTarget !== null}
        onClose={() => setRestockTarget(null)}
        title={restockTarget ? `Add copies of "${restockTarget.title}"` : 'Add copies'}
        footer={
          <>
            <Button variant="outline" onClick={() => setRestockTarget(null)} disabled={isRestocking}>
              Cancel
            </Button>
            <Button onClick={handleRestock} isLoading={isRestocking}>
              Add copies
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {restockTarget && (
            <p className="text-sm text-slate-600">
              Currently {restockTarget.availableCopies} of {restockTarget.totalCopies} copies available.
            </p>
          )}
          <Input
            label="Copies to add"
            type="number"
            min={1}
            value={restockCount}
            onChange={(e) => setRestockCount(e.target.value)}
          />
          {restockError && <p className="text-sm text-red-600">{restockError}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this book?"
        description={
          deleteTarget
            ? `"${deleteTarget.title}" will be removed from the catalogue. This can't be undone from here.`
            : ''
        }
        confirmLabel="Delete"
        danger
        isLoading={isDeleting}
        onConfirm={handleDeleteBook}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
