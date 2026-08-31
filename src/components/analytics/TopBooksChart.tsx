import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

// Sequential single hue (blue, step 450) — this is a magnitude ranking of one measure
// across items, not distinct identities, so every bar shares one hue per the dataviz
// skill's form guidance ("compare magnitude -> bar, color job: sequential").
const BAR_COLOR = '#2a78d6'

export interface TopBooksChartRow {
  id: string
  title: string
  count: number
}

function truncate(title: string, max = 28): string {
  return title.length > max ? `${title.slice(0, max - 1)}…` : title
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TopBooksChartRow }> }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-slate-700">{row.title}</p>
      <p className="mt-1">
        <span className="font-semibold text-slate-900">{row.count}</span>
      </p>
    </div>
  )
}

export function TopBooksChart({ data }: { data: TopBooksChartRow[] }) {
  const height = Math.max(data.length * 36 + 24, 120)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }} barCategoryGap={10}>
        <XAxis type="number" allowDecimals={false} hide />
        <YAxis
          type="category"
          dataKey="title"
          width={160}
          tickFormatter={(value: string) => truncate(value)}
          tick={{ fontSize: 12, fill: '#52514e' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9f9f7' }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20} label={{ position: 'right', fontSize: 12, fill: '#52514e' }}>
          {data.map((row) => (
            <Cell key={row.id} fill={BAR_COLOR} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
