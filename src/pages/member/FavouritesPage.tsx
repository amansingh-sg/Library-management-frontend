import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Heart } from 'lucide-react'
import { getMyFavourites, removeFavourite } from '@/api/favourites.api'
import { getAuthors } from '@/api/authors.api'
import { getBooks } from '@/api/books.api'
import { getErrorMessage } from '@/api/client'
import { PageHeader } from '@/components/member/PageHeader'
import { BookCard } from '@/components/member/BookCard'
import { Button } from '@/components/ui/Button'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Pagination } from '@/components/ui/Pagination'
import type { Author, Book, Favourite, PaginatedResponse } from '@/types/models'

export default function FavouritesPage() {
  const [page, setPage] = useState<PaginatedResponse<Favourite> | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [books, setBooks] = useState<Book[]>([])
  const [authors, setAuthors] = useState<Author[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyBookId, setBusyBookId] = useState<string | null>(null)

  const favourites = page?.data ?? []
  const bookById = useMemo(() => new Map(books.map((b) => [b.id, b])), [books])
  const authorNameById = useMemo(() => new Map(authors.map((a) => [a.id, a.name])), [authors])

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    // Books are fetched in full here (not paginated) — it's a lookup map to join
    // favourites onto, not the list this page paginates.
    Promise.all([getMyFavourites({ page: pageNumber }), getBooks({}, { perPage: 500 }), getAuthors()])
      .then(([favouriteResult, bookResult, authorResult]) => {
        setPage(favouriteResult)
        setBooks(bookResult.data)
        setAuthors(authorResult)
      })
      .catch((err) => setError(getErrorMessage(err, 'Unable to load your favourites.')))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber])

  useEffect(() => {
    load()
  }, [load])

  async function handleRemove(book: Book) {
    setBusyBookId(book.id)
    try {
      await removeFavourite(book.id)
      setPage((prev) => prev && { ...prev, data: prev.data.filter((f) => f.bookId !== book.id) })
      toast.success('Removed from favourites')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to remove favourite.'))
    } finally {
      setBusyBookId(null)
    }
  }

  const favouriteBooks = favourites.map((f) => bookById.get(f.bookId)).filter((b): b is Book => Boolean(b))

  return (
    <div>
      <PageHeader title="Favourites" description="Books you've saved for later." />

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {!isLoading && error && <ErrorState message={error} onRetry={load} />}

      {!isLoading && !error && favouriteBooks.length === 0 && (
        <EmptyState
          icon={Heart}
          title="No favourites yet"
          description="Save books you're interested in to find them here later."
          action={
            <Link to="/books">
              <Button size="sm">Browse books</Button>
            </Link>
          }
        />
      )}

      {!isLoading && !error && favouriteBooks.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {favouriteBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                authorName={authorNameById.get(book.authorId) ?? 'Unknown author'}
                isFavourite
                favouriteBusy={busyBookId === book.id}
                onToggleFavourite={handleRemove}
              />
            ))}
          </div>
          {page && <Pagination page={page} onPageChange={setPageNumber} isLoading={isLoading} />}
        </>
      )}
    </div>
  )
}
