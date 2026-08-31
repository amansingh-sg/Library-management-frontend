import type { ComponentType } from 'react'
import { cn } from '@/utils/cn'

interface KpiCardProps {
  label: string
  value: string | number
  icon: ComponentType<{ className?: string }>
  tone?: 'brand' | 'green' | 'amber' | 'red' | 'purple'
  hint?: string
}

const toneClasses: Record<NonNullable<KpiCardProps['tone']>, string> = {
  brand: 'bg-brand-50 text-brand-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  purple: 'bg-purple-50 text-purple-600',
}

export function KpiCard({ label, value, icon: Icon, tone = 'brand', hint }: KpiCardProps) {
  return (
    <div className="flex items-start justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      </div>
      <div className={cn('flex size-10 items-center justify-center rounded-lg', toneClasses[tone])}>
        <Icon className="size-5" />
      </div>
    </div>
  )
}
