import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BookMarked,
  BookOpen,
  CalendarClock,
  Heart,
  Library,
  Sparkles,
} from 'lucide-react'
import { getMyLoans } from '@/api/loans.api'
import { getMyReservations } from '@/api/reservations.api'
import { getMyFavourites } from '@/api/favourites.api'
import { getBooks } from '@/api/books.api'
import { getErrorMessage } from '@/api/client'
import { KpiCard } from '@/components/ui/KpiCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { LoanStatusBadge } from '@/components/common/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/utils/format'
import { Permission, ReservationStatus } from '@/types/enums'
import { cn } from '@/utils/cn'
import type { Book, Loan, Reservation } from '@/types/models'

function greetingForHour(hour: number): string {
  if (hour < 5) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email
  const first = local.split(/[.\-_]/)[0] ?? local
  return first.charAt(0).toUpperCase() + first.slice(1)
}

function isDueSoon(loan: Loan): boolean {
  if (loan.status !== 'ACTIVE') return false
  const daysLeft = (new Date(loan.dueAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return daysLeft >= 0 && daysLeft <= 3
}

interface QuickLink {
  label: string
  to: string
  icon: typeof BookOpen
  hint: string
}

export default function DashboardPage() {
  const { user, hasPermission } = useAuth()
  const [loans, setLoans] = useState<Loan[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [favouritesCount, setFavouritesCount] = useState(0)
  const [availableBooks, setAvailableBooks] = useState<Book[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canViewOwnLoans = hasPermission(Permission.VIEW_OWN_LOANS)
  const canViewOwnReservations = hasPermission(Permission.VIEW_OWN_RESERVATIONS)

  const loadDashboard = () => {
    setIsLoading(true)
    setError(null)
    // Not every role that lands on "/" holds the member-self-service permissions
    // (e.g. LIBRARIAN/STAFF don't have VIEW_OWN_LOANS by default) — only call each
    // endpoint when permitted, and never surface a permission gap as a page error.
    Promise.all([
      canViewOwnLoans ? getMyLoans() : Promise.resolve<Loan[]>([]),
      canViewOwnReservations ? getMyReservations() : Promise.resolve<Reservation[]>([]),
      getMyFavourites().catch(() => []),
      getBooks().catch(() => []),
    ])
      .then(([loanResult, reservationResult, favouriteResult, books]) => {
        setLoans(loanResult)
        setReservations(reservationResult)
        setFavouritesCount(favouriteResult.length)
        setAvailableBooks(books.filter((b) => b.availableCopies > 0).slice(0, 5))
      })
      .catch((err) => setError(getErrorMessage(err, 'Unable to load your dashboard.')))
      .finally(() => setIsLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadDashboard, [canViewOwnLoans, canViewOwnReservations])

  const activeLoans = loans.filter((l) => l.status !== 'RETURNED')
  const overdueLoans = loans.filter((l) => l.status === 'OVERDUE')
  const dueSoonLoans = loans.filter(isDueSoon)
  const activeReservations = reservations.filter(
    (r) => r.status === ReservationStatus.WAITING || r.status === ReservationStatus.READY,
  )
  const recentLoans = [...loans]
    .sort((a, b) => new Date(b.borrowedAt).getTime() - new Date(a.borrowedAt).getTime())
    .slice(0, 5)

  const greeting = useMemo(() => greetingForHour(new Date().getHours()), [])
  const name = user ? displayNameFromEmail(user.email) : ''
  const initials = user ? name.slice(0, 2).toUpperCase() : '??'

  const quickLinks: QuickLink[] = [
    { label: 'Browse Books', to: '/books', icon: BookOpen, hint: 'Find your next read' },
    ...(canViewOwnLoans
      ? [{ label: 'My Loans', to: '/my-loans', icon: Library, hint: `${activeLoans.length} active` }]
      : []),
    ...(canViewOwnReservations
      ? [
          {
            label: 'My Reservations',
            to: '/my-reservations',
            icon: CalendarClock,
            hint: `${activeReservations.length} pending`,
          },
        ]
      : []),
    { label: 'Favourites', to: '/favourites', icon: Heart, hint: `${favouritesCount} saved` },
  ]

  if (error) {
    return <ErrorState message={error} onRetry={loadDashboard} />
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-600 to-indigo-700 px-6 py-8 text-white shadow-sm sm:px-8">
        <Sparkles className="pointer-events-none absolute -right-4 -top-6 size-32 text-white/10" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-lg font-semibold ring-1 ring-white/25">
              {initials}
            </div>
            <div>
              <h1 className="text-xl font-semibold sm:text-2xl">
                {greeting}
                {name ? `, ${name}` : ''}
              </h1>
              <p className="mt-1 text-sm text-brand-100">
                {dueSoonLoans.length > 0
                  ? `You have ${dueSoonLoans.length} loan${dueSoonLoans.length > 1 ? 's' : ''} due soon.`
                  : overdueLoans.length > 0
                    ? `You have ${overdueLoans.length} overdue loan${overdueLoans.length > 1 ? 's' : ''} to resolve.`
                    : "Here's what's happening in your library today."}
              </p>
            </div>
          </div>
          <Link
            to="/books"
            className="inline-flex items-center gap-1.5 self-start rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50 sm:self-auto"
          >
            Browse books
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            {canViewOwnLoans && <KpiCard label="Active Loans" value={activeLoans.length} icon={Library} tone="brand" />}
            {canViewOwnLoans && (
              <KpiCard
                label="Overdue"
                value={overdueLoans.length}
                icon={AlertTriangle}
                tone={overdueLoans.length > 0 ? 'red' : 'green'}
                hint={dueSoonLoans.length > 0 ? `${dueSoonLoans.length} due soon` : undefined}
              />
            )}
            {canViewOwnReservations && (
              <KpiCard label="Reservations" value={activeReservations.length} icon={CalendarClock} tone="amber" />
            )}
            <KpiCard label="Favourites" value={favouritesCount} icon={Heart} tone="purple" />
          </>
        )}
      </div>

      {!isLoading && quickLinks.length > 1 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-brand-50 group-hover:text-brand-600">
                <link.icon className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{link.label}</p>
                <p className="truncate text-xs text-slate-400">{link.hint}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {canViewOwnLoans && (
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Recent Loans</CardTitle>
              <Link
                to="/my-loans"
                className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                View all
                <ArrowRight className="size-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : recentLoans.length === 0 ? (
                <EmptyState
                  icon={Library}
                  title="No loans yet"
                  description="Books you borrow will show up here."
                  action={
                    <Link to="/books" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                      Browse the catalogue →
                    </Link>
                  }
                />
              ) : (
                <ul className="flex flex-col divide-y divide-slate-100">
                  {recentLoans.map((loan) => {
                    const dueSoon = isDueSoon(loan)
                    return (
                      <li key={loan.id} className="flex items-center gap-3 py-3">
                        <div
                          className={cn(
                            'flex size-9 shrink-0 items-center justify-center rounded-lg',
                            loan.status === 'OVERDUE'
                              ? 'bg-red-50 text-red-500'
                              : dueSoon
                                ? 'bg-amber-50 text-amber-500'
                                : 'bg-slate-100 text-slate-400',
                          )}
                        >
                          <BookMarked className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">Due {formatDate(loan.dueAt)}</p>
                          <p className="truncate text-xs text-slate-400">Borrowed {formatDate(loan.borrowedAt)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {dueSoon && <Badge tone="amber">Due soon</Badge>}
                          <LoanStatusBadge status={loan.status} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Available to Borrow</CardTitle>
            <Link
              to="/books"
              className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Browse all
              <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : availableBooks.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="Nothing available right now"
                description="Every copy is currently checked out — check back soon."
              />
            ) : (
              <ul className="flex flex-col divide-y divide-slate-100">
                {availableBooks.map((book) => (
                  <li key={book.id}>
                    <Link
                      to={`/books/${book.id}`}
                      className="group flex items-center gap-3 py-3 text-sm text-slate-700"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 transition-colors group-hover:bg-brand-50 group-hover:text-brand-600">
                        <BookMarked className="size-4" />
                      </div>
                      <span className="min-w-0 flex-1 truncate font-medium group-hover:text-brand-600">
                        {book.title}
                      </span>
                      <Badge tone="green">{book.availableCopies} left</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
