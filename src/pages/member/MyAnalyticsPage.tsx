import { useEffect, useMemo, useState } from 'react'
import { BarChart3, CheckCircle2, CircleDollarSign, Info } from 'lucide-react'
import { getMyLoans } from '@/api/loans.api'
import { getMyReservations } from '@/api/reservations.api'
import { getMyFavourites } from '@/api/favourites.api'
import { getBookById } from '@/api/books.api'
import { getErrorMessage } from '@/api/client'
import { PageHeader } from '@/components/member/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { formatDate, formatFine } from '@/utils/format'
import { Permission } from '@/types/enums'
import type { Favourite, Loan, Reservation } from '@/types/models'
import { TrendsChart, type TrendChartPoint } from '@/components/analytics/TrendsChart'

// Mirrors AnalyticsService.getMemberAnalytics()'s categorisation exactly (same
// thresholds, same "engagement score = loans*5 + reservations*3 + favourites"
// formula) - that endpoint requires MANAGE_USERS, which a plain member never has,
// so this recomputes it client-side from data the member's own existing
// endpoints (getMyLoans/getMyReservations/getMyFavourites) already return,
// rather than adding a new API a member could call.
type MemberCategory = 'Highly Active' | 'Active' | 'At Risk' | 'Inactive'

function categorize(engagementScore: number, lastActivity: Date | null): MemberCategory {
  if (!lastActivity) return 'Inactive'
  const daysSinceActivity = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
  if (engagementScore >= 30 && daysSinceActivity <= 30) return 'Highly Active'
  if (engagementScore >= 15 && daysSinceActivity <= 60) return 'Active'
  if (daysSinceActivity <= 90) return 'At Risk'
  return 'Inactive'
}

const categoryTone: Record<MemberCategory, 'green' | 'blue' | 'amber' | 'slate'> = {
  'Highly Active': 'green',
  Active: 'blue',
  'At Risk': 'amber',
  Inactive: 'slate',
}

function monthKey(value: string): string {
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

// A member's personal view of the activity/engagement/fines analytics that
// librarians and admins see for everyone - computed client-side from the member's
// own loans/reservations/favourites (see the categorize() note above) since the
// full analytics endpoint requires a permission members don't have.
export default function MyAnalyticsPage() {
  const { hasPermission } = useAuth()
  const canViewOwnLoans = hasPermission(Permission.VIEW_OWN_LOANS)
  const canViewOwnReservations = hasPermission(Permission.VIEW_OWN_RESERVATIONS)

  const [loans, setLoans] = useState<Loan[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [favourites, setFavourites] = useState<Favourite[]>([])
  const [favouritesCount, setFavouritesCount] = useState(0)
  // Lifetime totals (PaginatedResponse.total) - distinct from loans.length/
  // reservations.length, which are capped at whatever perPage was fetched below.
  const [loanTotal, setLoanTotal] = useState(0)
  const [reservationTotal, setReservationTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fineBookTitleById, setFineBookTitleById] = useState<Map<string, string>>(new Map())
  const [showFineInfo, setShowFineInfo] = useState(false)
  const [showActivityInfo, setShowActivityInfo] = useState(false)

  const load = () => {
    setIsLoading(true)
    setError(null)
    // Reservations explicitly sorted newest-first (the endpoint's own default is
    // oldest-first - see reservation.repository.ts's getByUserId) so that, same as
    // loans/favourites below, the first item of whatever page comes back is
    // reliably the most recent one - used for the engagement "last activity" calc
    // further down, without needing to fetch every reservation just to find its max.
    Promise.all([
      canViewOwnLoans ? getMyLoans({ perPage: 100 }) : Promise.resolve(null),
      canViewOwnReservations
        ? getMyReservations({ perPage: 100, sortBy: 'reservedAt', sortOrder: 'DESC' })
        : Promise.resolve(null),
      getMyFavourites().catch(() => null),
    ])
      .then(([loanResult, reservationResult, favouriteResult]) => {
        setLoans(loanResult?.data ?? [])
        setLoanTotal(loanResult?.total ?? 0)
        setReservations(reservationResult?.data ?? [])
        setReservationTotal(reservationResult?.total ?? 0)
        setFavourites(favouriteResult?.data ?? [])
        setFavouritesCount(favouriteResult?.total ?? 0)
      })
      .catch((err) => setError(getErrorMessage(err, 'Unable to load your analytics.')))
      .finally(() => setIsLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [canViewOwnLoans, canViewOwnReservations])

  // fineAmount is what's still OUTSTANDING (already net of anything a librarian has
  // recorded as paid - see loans.service.ts's toLoanDto) - so this naturally drops
  // off the list the moment a fine is settled, without the member needing to do
  // anything.
  const finedLoans = [...loans]
    .filter((l) => l.fineAmount > 0)
    .sort((a, b) => b.fineAmount - a.fineAmount)
  const totalFineOwed = finedLoans.reduce((sum, l) => sum + l.fineAmount, 0)

  // Same formula as AnalyticsService.getMemberActivity()'s engagement_score, using
  // lifetime totals (not the perPage-capped arrays) so this matches what that
  // endpoint would compute for this same member.
  const engagementScore = loanTotal * 5 + reservationTotal * 3 + favouritesCount

  // Most recent activity across all three - loans/favourites are fetched
  // newest-first by default, reservations explicitly so above, so index 0 of each
  // (if present) is already the latest regardless of how many total exist.
  const lastActivityCandidates = [loans[0]?.borrowedAt, reservations[0]?.reservedAt, favourites[0]?.createdAt]
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
  const lastActivity = lastActivityCandidates.length > 0 ? new Date(Math.max(...lastActivityCandidates)) : null
  const memberCategory = categorize(engagementScore, lastActivity)

  // Own borrowing/reservation history by month, for the same trend shape the admin
  // Analytics page's TrendsChart already renders - grouped client-side from the
  // loans/reservations already fetched above rather than a new per-member trends
  // endpoint.
  const activityTrend: TrendChartPoint[] = useMemo(() => {
    const byMonth = new Map<string, TrendChartPoint>()
    for (const loan of loans) {
      const key = monthKey(loan.borrowedAt)
      const point = byMonth.get(key) ?? { period: key, borrows: 0, reservations: 0 }
      point.borrows += 1
      byMonth.set(key, point)
    }
    for (const reservation of reservations) {
      const key = monthKey(reservation.reservedAt)
      const point = byMonth.get(key) ?? { period: key, borrows: 0, reservations: 0 }
      point.reservations += 1
      byMonth.set(key, point)
    }
    return Array.from(byMonth.values()).sort((a, b) => a.period.localeCompare(b.period))
  }, [loans, reservations])

  // Resolves book titles for just the fined loans - by id, since this page doesn't
  // otherwise fetch the full catalogue.
  useEffect(() => {
    const missingIds = Array.from(new Set(finedLoans.map((l) => l.bookId))).filter(
      (id) => !fineBookTitleById.has(id),
    )
    if (missingIds.length === 0) return

    let cancelled = false
    Promise.all(missingIds.map((id) => getBookById(id).catch(() => null))).then((results) => {
      if (cancelled) return
      setFineBookTitleById((prev) => {
        const next = new Map(prev)
        missingIds.forEach((id, i) => {
          const book = results[i]
          if (book) next.set(id, book.title)
        })
        return next
      })
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loans])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="My Analytics" description="Your activity, engagement, and any fines across the library." />
        <SkeletonCard />
        <SkeletonTable rows={4} cols={3} />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <PageHeader title="My Analytics" />
        <ErrorState message={error} onRetry={load} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My Analytics" description="Your activity, engagement, and any fines across the library." />

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CardTitle>My Activity</CardTitle>
            <button
              type="button"
              onClick={() => setShowActivityInfo(true)}
              aria-label="How this is calculated"
              className="inline-flex size-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <Info className="size-4" />
            </button>
          </div>
          <Badge tone={categoryTone[memberCategory]}>{memberCategory}</Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Books borrowed</p>
              <p className="text-lg font-semibold text-slate-900">{loanTotal}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Reservations made</p>
              <p className="text-lg font-semibold text-slate-900">{reservationTotal}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Favourites saved</p>
              <p className="text-lg font-semibold text-slate-900">{favouritesCount}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Engagement score</p>
              <p className="text-lg font-semibold text-slate-900">{engagementScore}</p>
            </div>
          </div>
          {activityTrend.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-xs text-slate-500">Your borrowing &amp; reservation history over time.</p>
              <TrendsChart data={activityTrend} />
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                icon={BarChart3}
                title="No activity yet"
                description="Borrow or reserve a book and your history will show up here."
              />
            </div>
          )}
        </CardContent>
      </Card>

      {canViewOwnLoans && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CardTitle>My Fines</CardTitle>
              <button
                type="button"
                onClick={() => setShowFineInfo(true)}
                aria-label="How fines are calculated"
                className="inline-flex size-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <Info className="size-4" />
              </button>
            </div>
            {totalFineOwed > 0 && <Badge tone="red">{formatFine(totalFineOwed)} owed</Badge>}
          </CardHeader>
          <CardContent>
            {finedLoans.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No fines"
                description="Return your books on time and you'll never see one here."
              />
            ) : (
              <ul className="flex flex-col divide-y divide-slate-100">
                {finedLoans.map((loan) => (
                  <li key={loan.id} className="flex items-center gap-3 py-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500">
                      <CircleDollarSign className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {fineBookTitleById.get(loan.bookId) ?? 'Unknown book'}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {loan.status === 'ACTIVE' || loan.status === 'OVERDUE'
                          ? 'Still out'
                          : loan.status === 'RETURN_REQUESTED'
                            ? 'Return requested'
                            : loan.status === 'LOST'
                              ? 'Lost'
                              : loan.status === 'DAMAGED'
                                ? 'Damaged'
                                : 'Returned'}{' '}
                        · Due {formatDate(loan.dueAt)}
                      </p>
                    </div>
                    <span className="shrink-0 font-medium text-red-600">{formatFine(loan.fineAmount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Modal open={showFineInfo} onClose={() => setShowFineInfo(false)} title="How fines are calculated">
        <div className="flex flex-col gap-3 text-sm text-slate-600">
          <p>
            A fine starts accruing the day after a loan's due date, at a flat rate for every day the book stays
            overdue.
          </p>
          <p>
            Returning the book stops it from growing any further — the fine is frozen at whatever it had reached on
            the day you returned it, even if you check back much later.
          </p>
          <p>A loan returned on or before its due date never accrues a fine.</p>
          <p>
            If a fine you've paid at the desk still shows here, it hasn't been recorded yet — ask a librarian to mark
            it as paid, and it'll disappear from this list automatically.
          </p>
        </div>
      </Modal>

      <Modal open={showActivityInfo} onClose={() => setShowActivityInfo(false)} title="How this is calculated">
        <div className="flex flex-col gap-3 text-sm text-slate-600">
          <p>
            The counts above are lifetime totals — every book you've ever borrowed or reserved and every favourite
            you've saved, not just what's currently active.
          </p>
          <p>
            Engagement score adds those up with more weight on borrowing: 5 points per book borrowed, 3 per
            reservation, 1 per favourite.
          </p>
          <p>
            Your category combines that score with how recently you've been active: <strong>Highly Active</strong>{' '}
            needs a score of 30+ and activity in the last 30 days, <strong>Active</strong> needs 15+ and 60 days,{' '}
            <strong>At Risk</strong> is anyone active within 90 days who doesn't clear those bars, and{' '}
            <strong>Inactive</strong> is everyone else. This is the same scoring librarians and admins see for every
            member on the library's Analytics page — you're just seeing your own.
          </p>
        </div>
      </Modal>
    </div>
  )
}
