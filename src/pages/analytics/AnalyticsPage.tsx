import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Library,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { KpiCard } from '@/components/ui/KpiCard'
import { Select } from '@/components/ui/Select'
import { Table, type Column } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { useAuth } from '@/hooks/useAuth'
import { Permission } from '@/types/enums'
import { formatDate, formatDateTime, formatFine, toNumber } from '@/utils/format'
import {
  getBookAnalytics,
  getBorrowingTrends,
  getDashboardSummary,
  getMemberAnalytics,
  getOverdueLoans,
  getReservationTrends,
} from '@/api/analytics.api'
import type { BookAnalyticsRow, MemberAnalyticsRow, OverdueLoanRow, TrendPeriod } from '@/types/models'
import { useSectionData } from '@/components/analytics/useSectionData'
import { TrendsChart, type TrendChartPoint } from '@/components/analytics/TrendsChart'
import { TopBooksChart, type TopBooksChartRow } from '@/components/analytics/TopBooksChart'

const categoryTone: Record<MemberAnalyticsRow['category'], 'green' | 'blue' | 'amber' | 'slate'> = {
  'Highly Active': 'green',
  Active: 'blue',
  'At Risk': 'amber',
  Inactive: 'slate',
}

function toRows(rows: BookAnalyticsRow[], countKey: keyof BookAnalyticsRow): TopBooksChartRow[] {
  return rows.map((row) => ({ id: row.id, title: row.title, count: toNumber(row[countKey] as number | string | undefined) }))
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export default function AnalyticsPage() {
  const { hasPermission } = useAuth()
  const canViewMembers = hasPermission(Permission.MANAGE_USERS)
  const canViewOverdue = hasPermission(Permission.MANAGE_LOANS)

  const [period, setPeriod] = useState<TrendPeriod>('month')

  const summary = useSectionData(getDashboardSummary, [])
  const bookAnalytics = useSectionData(() => getBookAnalytics(10), [])
  const borrowingTrends = useSectionData(() => getBorrowingTrends(period), [period])
  const reservationTrends = useSectionData(() => getReservationTrends(period), [period])
  const memberAnalytics = useSectionData<MemberAnalyticsRow[]>(
    () => (canViewMembers ? getMemberAnalytics() : Promise.resolve([])),
    [canViewMembers],
  )
  const overdueLoans = useSectionData<OverdueLoanRow[]>(
    () => (canViewOverdue ? getOverdueLoans() : Promise.resolve([])),
    [canViewOverdue],
  )

  const trendData: TrendChartPoint[] = useMemo(() => {
    const byPeriod = new Map<string, TrendChartPoint>()
    for (const point of borrowingTrends.data ?? []) {
      byPeriod.set(point.period, { period: point.period, borrows: toNumber(point.borrow_count), reservations: 0 })
    }
    for (const point of reservationTrends.data ?? []) {
      const existing = byPeriod.get(point.period)
      if (existing) {
        existing.reservations = toNumber(point.reservation_count)
      } else {
        byPeriod.set(point.period, { period: point.period, borrows: 0, reservations: toNumber(point.reservation_count) })
      }
    }
    return Array.from(byPeriod.values()).sort((a, b) => a.period.localeCompare(b.period))
  }, [borrowingTrends.data, reservationTrends.data])

  const memberCategoryCounts = useMemo(() => {
    const counts: Record<MemberAnalyticsRow['category'], number> = {
      'Highly Active': 0,
      Active: 0,
      'At Risk': 0,
      Inactive: 0,
    }
    for (const row of memberAnalytics.data ?? []) counts[row.category] += 1
    return counts
  }, [memberAnalytics.data])

  const memberColumns: Column<MemberAnalyticsRow>[] = [
    { header: 'Rank', accessor: (r) => `#${r.rank}` },
    { header: 'Email', accessor: (r) => r.email },
    { header: 'Loans', accessor: (r) => r.totalLoans },
    { header: 'Reservations', accessor: (r) => r.totalReservations },
    { header: 'Favourites', accessor: (r) => r.totalFavourites },
    { header: 'Engagement', accessor: (r) => r.engagementScore },
    { header: 'Category', accessor: (r) => <Badge tone={categoryTone[r.category]}>{r.category}</Badge> },
    { header: 'Last activity', accessor: (r) => formatDateTime(r.lastActivity) },
  ]

  const overdueColumns: Column<OverdueLoanRow>[] = [
    { header: 'Book', accessor: (r) => r.title },
    { header: 'Member', accessor: (r) => r.email },
    { header: 'Borrowed', accessor: (r) => formatDate(r.borrowed_at) },
    { header: 'Due', accessor: (r) => <span className="font-medium text-red-600">{formatDate(r.due_at)}</span> },
    {
      header: 'Days overdue',
      accessor: (r) => {
        const days = Math.max(1, Math.ceil((Date.now() - new Date(r.due_at).getTime()) / (1000 * 60 * 60 * 24)))
        return <Badge tone="red">{days} day{days === 1 ? '' : 's'}</Badge>
      },
    },
    { header: 'Fine', accessor: (r) => <span className="font-medium text-red-600">{formatFine(r.fineAmount)}</span> },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-500">Library-wide insights across books, members, and activity.</p>
      </div>

      {/* KPI row */}
      {summary.isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : summary.error ? (
        <ErrorState message={summary.error} onRetry={summary.reload} />
      ) : summary.data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          <KpiCard label="Total books" value={summary.data.totalBooks} icon={BookOpen} tone="brand" />
          <KpiCard label="Total members" value={summary.data.totalMembers} icon={Users} tone="purple" />
          <KpiCard label="Active loans" value={summary.data.activeLoans} icon={Library} tone="green" />
          <KpiCard label="Overdue loans" value={summary.data.overdueLoans} icon={AlertTriangle} tone="red" />
          <KpiCard
            label="Outstanding fines"
            value={formatFine(summary.data.totalOutstandingFines)}
            icon={AlertTriangle}
            tone="red"
            hint="Sum of every overdue loan's fine"
          />
          <KpiCard
            label="Pending reservations"
            value={summary.data.pendingReservations.length}
            icon={CalendarClock}
            tone="amber"
            hint="Books with members waiting"
          />
        </div>
      ) : null}

      {/* Trends */}
      <SectionCard title="Borrowing & reservation trends">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Volume of new borrows and reservations over time.</p>
          <div className="w-36">
            <Select
              value={period}
              onChange={(e) => setPeriod(e.target.value as TrendPeriod)}
              aria-label="Trend period"
            >
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </Select>
          </div>
        </div>
        {borrowingTrends.isLoading || reservationTrends.isLoading ? (
          <SkeletonTable rows={4} cols={1} />
        ) : borrowingTrends.error || reservationTrends.error ? (
          <ErrorState
            message={borrowingTrends.error ?? reservationTrends.error ?? 'Failed to load trends.'}
            onRetry={() => {
              borrowingTrends.reload()
              reservationTrends.reload()
            }}
          />
        ) : trendData.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No activity yet" description="Trend data will appear once books are borrowed or reserved." />
        ) : (
          <TrendsChart data={trendData} />
        )}
      </SectionCard>

      {/* Book insights */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Most borrowed books">
          {bookAnalytics.isLoading ? (
            <SkeletonTable rows={5} cols={1} />
          ) : bookAnalytics.error ? (
            <ErrorState message={bookAnalytics.error} onRetry={bookAnalytics.reload} />
          ) : bookAnalytics.data && bookAnalytics.data.mostBorrowed.length > 0 ? (
            <TopBooksChart data={toRows(bookAnalytics.data.mostBorrowed, 'borrow_count')} />
          ) : (
            <EmptyState title="No loans yet" description="Borrowed books will be ranked here." />
          )}
        </SectionCard>

        <SectionCard title="Most favourited books">
          {bookAnalytics.isLoading ? (
            <SkeletonTable rows={5} cols={1} />
          ) : bookAnalytics.error ? (
            <ErrorState message={bookAnalytics.error} onRetry={bookAnalytics.reload} />
          ) : bookAnalytics.data && bookAnalytics.data.mostFavourited.length > 0 ? (
            <TopBooksChart data={toRows(bookAnalytics.data.mostFavourited, 'favourite_count')} />
          ) : (
            <EmptyState title="No favourites yet" description="Favourited books will be ranked here." />
          )}
        </SectionCard>

        <SectionCard title="Most reserved books">
          {bookAnalytics.isLoading ? (
            <SkeletonTable rows={5} cols={1} />
          ) : bookAnalytics.error ? (
            <ErrorState message={bookAnalytics.error} onRetry={bookAnalytics.reload} />
          ) : bookAnalytics.data && bookAnalytics.data.mostReserved.length > 0 ? (
            <TopBooksChart data={toRows(bookAnalytics.data.mostReserved, 'reservation_count')} />
          ) : (
            <EmptyState title="No reservations yet" description="Reserved books will be ranked here." />
          )}
        </SectionCard>

        <SectionCard title="Books with pending reservations">
          {bookAnalytics.isLoading ? (
            <SkeletonTable rows={5} cols={2} />
          ) : bookAnalytics.error ? (
            <ErrorState message={bookAnalytics.error} onRetry={bookAnalytics.reload} />
          ) : bookAnalytics.data && bookAnalytics.data.pendingReservations.length > 0 ? (
            <Table
              columns={[
                { header: 'Book', accessor: (r: BookAnalyticsRow) => r.title },
                { header: 'Waiting', accessor: (r: BookAnalyticsRow) => <Badge tone="amber">{toNumber(r.waiting_count)}</Badge> },
              ]}
              data={bookAnalytics.data.pendingReservations}
              rowKey={(r) => r.id}
            />
          ) : (
            <EmptyState icon={CheckCircle2} title="No pending reservations" description="Every reservation is currently fulfilled or waiting on availability only briefly." />
          )}
        </SectionCard>
      </div>

      {/* Member engagement */}
      {canViewMembers && (
        <SectionCard title="Member engagement">
          {memberAnalytics.isLoading ? (
            <SkeletonTable rows={6} cols={7} />
          ) : memberAnalytics.error ? (
            <ErrorState message={memberAnalytics.error} onRetry={memberAnalytics.reload} />
          ) : memberAnalytics.data && memberAnalytics.data.length > 0 ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(memberCategoryCounts) as MemberAnalyticsRow['category'][]).map((cat) => (
                  <Badge key={cat} tone={categoryTone[cat]}>
                    {memberCategoryCounts[cat]} {cat}
                  </Badge>
                ))}
              </div>
              <Table
                columns={memberColumns}
                data={[...memberAnalytics.data].sort((a, b) => a.rank - b.rank)}
                rowKey={(r) => r.userId}
              />
            </div>
          ) : (
            <EmptyState icon={Users} title="No member activity yet" description="Engagement scores will appear once members start borrowing, reserving, or favouriting books." />
          )}
        </SectionCard>
      )}

      {/* Overdue loans */}
      {canViewOverdue && (
        <SectionCard title="Overdue loans">
          {overdueLoans.isLoading ? (
            <SkeletonTable rows={4} cols={5} />
          ) : overdueLoans.error ? (
            <ErrorState message={overdueLoans.error} onRetry={overdueLoans.reload} />
          ) : overdueLoans.data && overdueLoans.data.length > 0 ? (
            <Table columns={overdueColumns} data={overdueLoans.data} rowKey={(r) => r.id} />
          ) : (
            <EmptyState icon={CheckCircle2} title="No overdue loans — nice!" description="Every active loan is within its due date." />
          )}
        </SectionCard>
      )}

      {!canViewMembers && !canViewOverdue && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          <ShieldAlert className="size-4 shrink-0" />
          Member engagement and overdue loan reports require additional permissions.
        </div>
      )}
    </div>
  )
}
