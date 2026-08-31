import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { getBooks } from '@/api/books.api'
import { getAuthors } from '@/api/authors.api'
import { getMyFavourites, addFavourite, removeFavourite } from '@/api/favourites.api'
import { getErrorMessage } from '@/api/client'
import { PageHeader } from '@/components/member/PageHeader'
import { BookCard } from '@/components/member/BookCard'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { useDebounce } from '@/hooks/useDebounce'
import { SEED_CATEGORIES } from '@/types/seed-categories'
import type { Author, Book } from '@/types/models'

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [authors, setAuthors] = useState<Author[]>([])
  const [favouriteBookIds, setFavouriteBookIds] = useState<Set<string>>(new Set())
  const [busyFavouriteId, setBusyFavouriteId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [authorFilter, setAuthorFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const debouncedSearch = useDebounce(search, 350)
  const debouncedAuthor = useDebounce(authorFilter, 350)

  const authorNameById = useMemo(() => new Map(authors.map((a) => [a.id, a.name])), [authors])

  useEffect(() => {
    getAuthors()
      .then(setAuthors)
      .catch(() => setAuthors([]))
    getMyFavourites()
      .then((favs) => setFavouriteBookIds(new Set(favs.map((f) => f.bookId))))
      .catch(() => setFavouriteBookIds(new Set()))
  }, [])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    getBooks({
      search: debouncedSearch || undefined,
      author: debouncedAuthor || undefined,
      category: categoryFilter || undefined,
    })
      .then((result) => {
        if (!cancelled) setBooks(result)
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
  }, [debouncedSearch, debouncedAuthor, categoryFilter, reloadToken])

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

  const hasFilters = Boolean(search || authorFilter || categoryFilter)

  return (
    <div>
      <PageHeader title="Books" description="Browse the library catalogue." />

      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            label="Search by title"
            placeholder="e.g. Dune"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <Input
            label="Author"
            placeholder="Filter by author name"
            value={authorFilter}
            onChange={(e) => setAuthorFilter(e.target.value)}
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
        {hasFilters && (
          <Button
            variant="ghost"
            size="md"
            onClick={() => {
              setSearch('')
              setAuthorFilter('')
              setCategoryFilter('')
            }}
          >
            <X className="size-4" />
            Clear
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {!isLoading && error && <ErrorState message={error} onRetry={() => setReloadToken((t) => t + 1)} />}

      {!isLoading && !error && books.length === 0 && (
        <EmptyState
          icon={Search}
          title="No books found"
          description="Try adjusting your search or filters."
        />
      )}

      {!isLoading && !error && books.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              authorName={authorNameById.get(book.authorId) ?? 'Unknown author'}
              isFavourite={favouriteBookIds.has(book.id)}
              favouriteBusy={busyFavouriteId === book.id}
              onToggleFavourite={handleToggleFavourite}
            />
          ))}
        </div>
      )}
    </div>
  )
}
