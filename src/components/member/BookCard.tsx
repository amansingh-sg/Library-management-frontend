import { Link } from 'react-router-dom'
import { Heart, User } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { getCategoryName } from '@/types/seed-categories'
import { cn } from '@/utils/cn'
import type { Book } from '@/types/models'

interface BookCardProps {
  book: Book
  authorName: string
  isFavourite?: boolean
  onToggleFavourite?: (book: Book) => void
  favouriteBusy?: boolean
}

export function BookCard({ book, authorName, isFavourite, onToggleFavourite, favouriteBusy }: BookCardProps) {
  const available = book.availableCopies > 0

  return (
    <Card className="group relative flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      {onToggleFavourite && (
        <button
          type="button"
          onClick={(e) => {
            // This button sits inside the card's <Link>, so stop the click from
            // bubbling up and navigating to the book detail page.
            e.preventDefault()
            e.stopPropagation()
            onToggleFavourite(book)
          }}
          disabled={favouriteBusy}
          aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
          className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-sm backdrop-blur transition-colors hover:text-red-500 disabled:opacity-50"
        >
          <Heart className={cn('size-4', isFavourite && 'fill-red-500 text-red-500')} />
        </button>
      )}
      <Link to={`/books/${book.id}`} className="flex flex-1 flex-col">
        <CardContent className="flex flex-1 flex-col gap-3">
          <div>
            <Badge tone="slate" className="mb-2">
              {getCategoryName(book.categoryId)}
            </Badge>
            <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">{book.title}</h3>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <User className="size-3" />
              {authorName}
            </p>
          </div>
          <div className="mt-auto flex items-center justify-between pt-2">
            <Badge tone={available ? 'green' : 'red'}>
              {available ? `${book.availableCopies} of ${book.totalCopies} available` : 'Unavailable'}
            </Badge>
            {book.publishedYear && <span className="text-xs text-slate-400">{book.publishedYear}</span>}
          </div>
        </CardContent>
      </Link>
    </Card>
  )
}
