import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, BookOpen, Calendar, Heart, Hash, User } from 'lucide-react'
import { getBookById } from '@/api/books.api'
import { getAuthors } from '@/api/authors.api'
import { borrowBook } from '@/api/loans.api'
import { createReservation } from '@/api/reservations.api'
import { addFavourite, getMyFavourites, removeFavourite } from '@/api/favourites.api'
import { getErrorMessage } from '@/api/client'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { Permission } from '@/types/enums'
import { getCategoryName } from '@/types/seed-categories'
import { cn } from '@/utils/cn'
import type { Author, Book } from '@/types/models'

export default function BookDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()

  const [book, setBook] = useState<Book | null>(null)
  const [author, setAuthor] = useState<Author | null>(null)
  const [isFavourite, setIsFavourite] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [borrowOpen, setBorrowOpen] = useState(false)
  const [isBorrowing, setIsBorrowing] = useState(false)
  const [isReserving, setIsReserving] = useState(false)
  const [isTogglingFavourite, setIsTogglingFavourite] = useState(false)

  const load = useCallback(() => {
    if (!id) return
    setIsLoading(true)
    setError(null)

    Promise.all([getBookById(id), getAuthors(), getMyFavourites()])
      .then(([bookResult, authors, favourites]) => {
        setBook(bookResult)
        setAuthor(authors.find((a) => a.id === bookResult.authorId) ?? null)
        setIsFavourite(favourites.some((f) => f.bookId === bookResult.id))
      })
      .catch((err) => setError(getErrorMessage(err, 'Unable to load this book.')))
      .finally(() => setIsLoading(false))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function handleBorrow() {
    if (!book) return
    setIsBorrowing(true)
    try {
      await borrowBook(book.id)
      toast.success('Book borrowed successfully. Check My Loans for the due date.')
      setBorrowOpen(false)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to borrow this book.'))
    } finally {
      setIsBorrowing(false)
    }
  }

  async function handleReserve() {
    if (!book) return
    setIsReserving(true)
    try {
      await createReservation(book.id)
      toast.success("Reserved. We'll notify you when it's ready to collect.")
      load()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to reserve this book.'))
    } finally {
      setIsReserving(false)
    }
  }

  async function handleToggleFavourite() {
    if (!book) return
    setIsTogglingFavourite(true)
    try {
      if (isFavourite) {
        await removeFavourite(book.id)
        setIsFavourite(false)
        toast.success('Removed from favourites')
      } else {
        await addFavourite(book.id)
        setIsFavourite(true)
        toast.success('Added to favourites')
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to update favourites.'))
    } finally {
      setIsTogglingFavourite(false)
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <Skeleton className="h-6 w-24" />
        <Card className="mt-4 p-6">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="mt-3 h-4 w-1/2" />
          <Skeleton className="mt-6 h-24 w-full" />
        </Card>
      </div>
    )
  }

  if (error || !book) {
    return <ErrorState message={error ?? 'Book not found.'} onRetry={load} />
  }

  const available = book.availableCopies > 0
  const canBorrow = hasPermission(Permission.BORROW_BOOKS)
  const canReserve = hasPermission(Permission.CREATE_RESERVATION)

  return (
    <div className="mx-auto max-w-2xl">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="size-4" />
        Back
      </button>

      <Card>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Badge tone="slate" className="mb-2">
                {getCategoryName(book.categoryId)}
              </Badge>
              <h1 className="text-xl font-semibold text-slate-900">{book.title}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                <User className="size-4" />
                {author?.name ?? 'Unknown author'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleFavourite}
              disabled={isTogglingFavourite}
              aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition-colors hover:text-red-500 disabled:opacity-50"
            >
              <Heart className={cn('size-5', isFavourite && 'fill-red-500 text-red-500')} />
            </button>
          </div>

          {author?.bio && <p className="text-sm text-slate-600">{author.bio}</p>}

          <dl className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="flex items-center gap-1.5 text-slate-400">
                <Hash className="size-3.5" /> ISBN
              </dt>
              <dd className="mt-0.5 font-medium text-slate-800">{book.isbn}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-slate-400">
                <Calendar className="size-3.5" /> Published
              </dt>
              <dd className="mt-0.5 font-medium text-slate-800">{book.publishedYear ?? '—'}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-slate-400">
                <BookOpen className="size-3.5" /> Copies
              </dt>
              <dd className="mt-0.5 font-medium text-slate-800">
                {book.availableCopies} of {book.totalCopies} available
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center gap-3">
            {canBorrow && (
              <Button onClick={() => setBorrowOpen(true)} disabled={!available}>
                Borrow this book
              </Button>
            )}
            {canReserve && (
              <Button variant="outline" onClick={handleReserve} isLoading={isReserving} disabled={available}>
                Reserve
              </Button>
            )}
            <p className="text-xs text-slate-400">
              {available
                ? 'Copies are available, so it can be borrowed directly — reserving is only available once all copies are checked out.'
                : 'All copies are currently checked out. Reserve to join the waiting list.'}
            </p>
          </div>

          <Link to="/books" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            ← Back to all books
          </Link>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={borrowOpen}
        title="Borrow this book?"
        description={`You're about to borrow "${book.title}". You'll need to return it by the due date shown in My Loans.`}
        confirmLabel="Borrow"
        isLoading={isBorrowing}
        onConfirm={handleBorrow}
        onCancel={() => setBorrowOpen(false)}
      />
    </div>
  )
}
