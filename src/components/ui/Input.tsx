import { type InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/utils/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? props.name
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40',
            error ? 'border-red-400 focus:border-red-500' : 'border-slate-300 focus:border-brand-500',
            className,
          )}
          {...props}
        />
        {error && <span className="text-xs text-red-600">{error}</span>}
        {!error && hint && <span className="text-xs text-slate-500">{hint}</span>}
      </div>
    )
  },
)
Input.displayName = 'Input'
