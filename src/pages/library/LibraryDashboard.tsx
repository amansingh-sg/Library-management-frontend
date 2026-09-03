import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BookMarked,
  BookOpen,
  CalendarClock,
  Library,
  Sparkles,
  Users,
} from 'lucide-react'
import { getDashboardSummary, getOverdueLoans } from '@/api/analytics.api'
import { getErrorMessage } from '@/api/client'
import { KpiCard } from '@/components/ui/KpiCard'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { useAuth } from '@/hooks/useAuth'
import { formatDate, formatFine } from '@/utils/format'
import type { DashboardSummary, OverdueLoanRow } from '@/types/models'

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

interface QuickLink {
  label: string
  to: string
  icon: typeof BookOpen
  hint: string
}

// Landing page for staff/librarians/admins after login - a library-wide overview,
// not a member's personal dashboard. On mount it loads the summary KPIs (books,
// members, active/overdue loans, outstanding fines) and the list of overdue loans
// used to build the "Most Overdue" panel below.
export default function LibraryDashboard() {
  const { user } = useAuth()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [overdueLoans, setOverdueLoans] = useState<OverdueLoanRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setIsLoading(true)
    setError(null)
    Promise.all([getDashboardSummary(), getOverdueLoans()])
      .then(([summaryResult, overdueResult]) => {
        setSummary(summaryResult)
        setOverdueLoans(overdueResult)
      })
      .catch((err) => setError(getErrorMessage(err, 'Unable to load the library dashboard.')))
      .finally(() => setIsLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [])

  const greeting = useMemo(() => greetingForHour(new Date().getHours()), [])
  const name = user ? displayNameFromEmail(user.email) : ''
  const initials = user ? name.slice(0, 2).toUpperCase() : '??'

  const worstOverdue = [...overdueLoans]
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
    .slice(0, 5)

  const quickLinks: QuickLink[] = [
    { label: 'Loans', to: '/loans', icon: Library, hint: `${summary?.activeLoans ?? 0} active` },
    {
      label: 'Reservations',
      to: '/reservations',
      icon: CalendarClock,
      hint: `${summary?.pendingReservations.length ?? 0} pending`,
    },
    { label: 'Browse Books', to: '/books', icon: BookOpen, hint: `${summary?.totalBooks ?? 0} in catalogue` },
    { label: 'Analytics', to: '/analytics', icon: Users, hint: 'Full library insights' },
  ]

  if (error) {
    return <ErrorState message={error} onRetry={load} />
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
                {summary && summary.overdueLoans > 0
                  ? `${summary.overdueLoans} loan${summary.overdueLoans > 1 ? 's are' : ' is'} overdue across the library.`
                  : "Here's what's happening across the library today."}
              </p>
            </div>
          </div>
          <Link
            to="/loans"
            className="inline-flex items-center gap-1.5 self-start rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50 sm:self-auto"
          >
            View loans
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : summary ? (
          <>
            <KpiCard label="Total books" value={summary.totalBooks} icon={BookOpen} tone="brand" />
            <KpiCard label="Total members" value={summary.totalMembers} icon={Users} tone="purple" />
            <KpiCard label="Active loans" value={summary.activeLoans} icon={Library} tone="green" />
            <KpiCard
              label="Overdue loans"
              value={summary.overdueLoans}
              icon={AlertTriangle}
              tone={summary.overdueLoans > 0 ? 'red' : 'green'}
            />
            <KpiCard
              label="Outstanding fines"
              value={formatFine(summary.totalOutstandingFines)}
              icon={AlertTriangle}
              tone="amber"
            />
          </>
        ) : null}
      </div>

      {!isLoading && (
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

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Most Overdue</CardTitle>
          <Link to="/loans" className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
            View all loans
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
          ) : worstOverdue.length === 0 ? (
            <EmptyState icon={Library} title="Nothing overdue" description="Every active loan is within its due date." />
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100">
              {worstOverdue.map((loan) => (
                <li key={loan.id} className="flex items-center gap-3 py-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500">
                    <BookMarked className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{loan.title}</p>
                    <p className="truncate text-xs text-slate-400">
                      {loan.email} · due {formatDate(loan.due_at)}
                    </p>
                  </div>
                  {loan.fineAmount > 0 ? (
                    <span className="shrink-0 text-sm font-semibold text-red-600">{formatFine(loan.fineAmount)}</span>
                  ) : Number(loan.fine_paid_amount) > 0 ? (
                    // Every row here is still ACTIVE and past its due date (see
                    // getOverdueLoans), so a fineAmount of 0 can only mean the fine
                    // was already paid off - never "no fine ever accrued". Without
                    // this, a settled loan showed a bare red "0.00" indistinguishable
                    // from an error, mixed in among genuinely-still-owing loans.
                    <Badge tone="green">Fine paid</Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
