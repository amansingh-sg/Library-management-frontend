import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatDate } from '@/utils/format'

// Categorical slots 1 (blue) & 2 (orange) from the validated palette — passes the
// dataviz skill's adjacent-pair CVD check (worst adjacent ΔE 24.7 protan / 33.6 normal).
const BORROW_COLOR = '#2a78d6'
const RESERVATION_COLOR = '#eb6834'

export interface TrendChartPoint {
  period: string
  borrows: number
  reservations: number
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-medium text-slate-500">{formatDate(label)}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="h-0.5 w-3 shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-500">{entry.name}</span>
          <span className="ml-auto font-semibold text-slate-900">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export function TrendsChart({ data }: { data: TrendChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="#e1e0d9" vertical={false} />
        <XAxis
          dataKey="period"
          tickFormatter={(value: string) => formatDate(value)}
          tick={{ fontSize: 12, fill: '#898781' }}
          axisLine={{ stroke: '#c3c2b7' }}
          tickLine={false}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#898781' }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#c3c2b7', strokeWidth: 1 }} />
        <Legend
          iconType="plainline"
          wrapperStyle={{ fontSize: 12, color: '#52514e' }}
        />
        <Line
          type="monotone"
          dataKey="borrows"
          name="Borrows"
          stroke={BORROW_COLOR}
          strokeWidth={2}
          dot={{ r: 4, fill: BORROW_COLOR, stroke: '#fff', strokeWidth: 2 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="reservations"
          name="Reservations"
          stroke={RESERVATION_COLOR}
          strokeWidth={2}
          dot={{ r: 4, fill: RESERVATION_COLOR, stroke: '#fff', strokeWidth: 2 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
