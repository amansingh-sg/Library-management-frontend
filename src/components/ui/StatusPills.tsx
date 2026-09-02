import { cn } from '@/utils/cn'

export interface StatusPillOption<T extends string> {
  value: T | ''
  label: string
}

interface StatusPillsProps<T extends string> {
  options: StatusPillOption<T>[]
  value: T | ''
  onChange: (value: T | '') => void
}

// Round, clickable filter buttons - an alternative to a dropdown for a small, fixed
// set of choices (a resource's status values) where every option should be visible
// and one-click to switch, rather than hidden behind a select.
export function StatusPills<T extends string>({ options, value, onChange }: StatusPillsProps<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value || 'all'}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
