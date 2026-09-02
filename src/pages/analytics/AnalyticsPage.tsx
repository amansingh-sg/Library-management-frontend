import { useEffect, useMemo, useState } from 'react'
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
import { StatusPills } from '@/components/ui/StatusPills'
import { Pagination } from '@/components/ui/Pagination'
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

const MEMBER_PAGE_SIZE = 10

interface MemberSortOption {
  value: string
  label: string
  compare: (a: MemberAnalyticsRow, b: MemberAnalyticsRow) => number
}

// getMemberAnalytics/getOverdueLoans return the full, unpaginated dataset (see
// analytics.api.ts) with no server-side sort param, so both are sorted client-side
// against whatever's already been fetched.
//
// No separate "sort by rank" option: the Rank column is RANK() OVER (ORDER BY
// engagement_score DESC) (see analytics.repository.ts's getMemberActivity), so
// sorting by rank ascending/descending is the exact same ordering as engagement
// score descending/ascending - offering both as separate, differently-worded menu
// entries just meant two options did the same thing under unclear names ("best"/
// "worst" rank, without saying rank of what). Engagement score alone says what's
// actually being compared.
const MEMBER_SORT_OPTIONS: MemberSortOption[] = [
  { value: 'engagement-desc', label: 'Engagement score (highest first)', compare: (a, b) => b.engagementScore - a.engagementScore },
  { value: 'engagement-asc', label: 'Engagement score (lowest first)', compare: (a, b) => a.engagementScore - b.engagementScore },
  { value: 'loans-desc', label: 'Most loans first', compare: (a, b) => b.totalLoans - a.totalLoans },
  { value: 'reservations-desc', label: 'Most reservations first', compare: (a, b) => b.totalReservations - a.totalReservations },
  { value: 'favourites-desc', label: 'Most favourites first', compare: (a, b) => b.totalFavourites - a.totalFavourites },
  {
    value: 'lastActivity-desc',
    label: 'Most recent activity first',
    compare: (a, b) => new Date(b.lastActivity ?? 0).getTime() - new Date(a.lastActivity ?? 0).getTime(),
  },
  { value: 'email-asc', label: 'Email (A–Z)', compare: (a, b) => a.email.localeCompare(b.email) },
]

interface OverdueSortOption {
  value: string
  label: string
  compare: (a: OverdueLoanRow, b: OverdueLoanRow) => number
}

// No separate "sort by fine" option: the fine is a flat rate per day overdue (see
// calculateFine in fine-calculator.ts - every loan accrues at the same RATE_PER_DAY),
// so it's always exactly proportional to days overdue. Sorting by fine amount would
// always produce the identical order to sorting by days overdue - keeping only the
// latter avoids offering two menu entries that do the same thing.
const OVERDUE_SORT_OPTIONS: OverdueSortOption[] = [
  {
    value: 'dueAt-asc',
    label: 'Most overdue first',
    compare: (a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime(),
  },
  {
    value: 'dueAt-desc',
    label: 'Least overdue first',
    compare: (a, b) => new Date(b.due_at).getTime() - new Date(a.due_at).getTime(),
  },
  { value: 'book-asc', label: 'Book title (A–Z)', compare: (a, b) => a.title.localeCompare(b.title) },
  { value: 'member-asc', label: 'Member (A–Z)', compare: (a, b) => a.email.localeCompare(b.email) },
]

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
  const [categoryFilter, setCategoryFilter] = useState<MemberAnalyticsRow['category'] | ''>('')
  const [memberPage, setMemberPage] = useState(1)
  const [memberSortValue, setMemberSortValue] = useState(MEMBER_SORT_OPTIONS[0].value)
  const [overdueSortValue, setOverdueSortValue] = useState(OVERDUE_SORT_OPTIONS[0].value)

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

  const memberSort = MEMBER_SORT_OPTIONS.find((o) => o.value === memberSortValue) ?? MEMBER_SORT_OPTIONS[0]

  const sortedMembers = useMemo(
    () => [...(memberAnalytics.data ?? [])].sort(memberSort.compare),
    [memberAnalytics.data, memberSort],
  )

  const filteredMembers = useMemo(
    () => (categoryFilter ? sortedMembers.filter((r) => r.category === categoryFilter) : sortedMembers),
    [sortedMembers, categoryFilter],
  )

  // Resets to page 1 whenever the category filter or sort changes, so switching
  // either never leaves the view stranded on a page past the end of the new
  // result set/order.
  useEffect(() => {
    setMemberPage(1)
  }, [categoryFilter, memberSortValue])

  const overdueSort = OVERDUE_SORT_OPTIONS.find((o) => o.value === overdueSortValue) ?? OVERDUE_SORT_OPTIONS[0]

  const sortedOverdueLoans = useMemo(
    () => [...(overdueLoans.data ?? [])].sort(overdueSort.compare),
    [overdueLoans.data, overdueSort],
  )

  // getMemberAnalytics returns the full, unpaginated member list (see analytics.api.ts)
  // - paginate the filtered rows client-side in the same PaginatedResponse shape the
  // shared <Pagination> component expects.
  const memberTotal = filteredMembers.length
  const memberLastPage = Math.max(1, Math.ceil(memberTotal / MEMBER_PAGE_SIZE))
  const memberCurrentPage = Math.min(memberPage, memberLastPage)
  const pagedMembers = filteredMembers.slice(
    (memberCurrentPage - 1) * MEMBER_PAGE_SIZE,
    memberCurrentPage * MEMBER_PAGE_SIZE,
  )
  const memberPaginationInfo = {
    data: pagedMembers,
    total: memberTotal,
    per_page: MEMBER_PAGE_SIZE,
    current_page: memberCurrentPage,
    last_page: memberLastPage,
    from: memberTotal === 0 ? null : (memberCurrentPage - 1) * MEMBER_PAGE_SIZE + 1,
    to: memberTotal === 0 ? null : Math.min(memberCurrentPage * MEMBER_PAGE_SIZE, memberTotal),
    prev_page: memberCurrentPage > 1 ? memberCurrentPage - 1 : null,
    next_page: memberCurrentPage < memberLastPage ? memberCurrentPage + 1 : null,
  }

  const memberColumns: Column<MemberAnalyticsRow>[] = [
    { header: 'Rank (by engagement)', accessor: (r) => `#${r.rank}` },
    { header: 'Email', accessor: (r) => r.email },
    { header: 'Loans', accessor: (r) => r.totalLoans },
    { header: 'Reservations', accessor: (r) => r.totalReservations },
    { header: 'Favourites', accessor: (r) => r.totalFavourites },
    { header: 'Engagement score', accessor: (r) => r.engagementScore },
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
    {
      header: 'Fine',
      // Every row here is still ACTIVE and past due (see getOverdueLoans), so a
      // fineAmount of 0 can only mean it's already been paid off - never "no fine
      // ever accrued" - see LoansManagementPage's identical "Fine paid" treatment.
      accessor: (r) =>
        r.fineAmount > 0 ? (
          <span className="font-medium text-red-600">{formatFine(r.fineAmount)}</span>
        ) : Number(r.fine_paid_amount) > 0 ? (
          <Badge tone="green">Fine paid</Badge>
        ) : null,
    },
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
              <div className="flex flex-wrap items-end justify-between gap-3">
                <StatusPills
                  options={[
                    { value: '', label: `All (${memberAnalytics.data.length})` },
                    ...(Object.keys(memberCategoryCounts) as MemberAnalyticsRow['category'][]).map((cat) => ({
                      value: cat,
                      label: `${cat} (${memberCategoryCounts[cat]})`,
                    })),
                  ]}
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                />
                <div className="w-64">
                  <Select label="Sort by" value={memberSortValue} onChange={(e) => setMemberSortValue(e.target.value)}>
                    {MEMBER_SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              {filteredMembers.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No members in this category"
                  description="Try a different filter."
                />
              ) : (
                <>
                  <Table columns={memberColumns} data={pagedMembers} rowKey={(r) => r.userId} />
                  <Pagination page={memberPaginationInfo} onPageChange={setMemberPage} isLoading={memberAnalytics.isLoading} />
                </>
              )}
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
            <div className="flex flex-col gap-4">
              <div className="flex justify-end">
                <div className="w-56">
                  <Select label="Sort by" value={overdueSortValue} onChange={(e) => setOverdueSortValue(e.target.value)}>
                    {OVERDUE_SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <Table columns={overdueColumns} data={sortedOverdueLoans} rowKey={(r) => r.id} />
            </div>
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
