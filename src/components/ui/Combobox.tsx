import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Plus, Search } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface ComboboxOption {
  value: string
  label: string
  sublabel?: string
}

interface ComboboxProps {
  label?: string
  value: string
  onChange: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  emptyMessage?: string
  // When set, shows an "Add <query>" row whenever nothing matches the typed text
  // exactly - used by the author picker so a missing author can be created inline
  // instead of blocking book creation on it existing beforehand.
  onCreate?: (query: string) => Promise<ComboboxOption>
  createLabel?: (query: string) => string
}

// A type-to-search dropdown: recommends matches as you type instead of asking you to
// scroll a long native <select> looking for a name. Filters client-side against the
// already-loaded `options` list (the same full lists these pages already fetch).
export function Combobox({
  label,
  value,
  onChange,
  options,
  placeholder = 'Search…',
  emptyMessage = 'No matches',
  onCreate,
  createLabel,
}: ComboboxProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  // Keeps the input showing the selected option's label while idle, but lets typing
  // search fresh - query is only "live" while the dropdown is open.
  useEffect(() => {
    if (!open) {
      setQuery(selected ? selected.label : '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, open])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return options
    return options.filter(
      (o) => o.label.toLowerCase().includes(term) || o.sublabel?.toLowerCase().includes(term),
    )
  }, [options, query])

  const trimmedQuery = query.trim()
  const hasExactMatch = filtered.some((o) => o.label.toLowerCase() === trimmedQuery.toLowerCase())
  const showCreate = Boolean(onCreate && trimmedQuery && !hasExactMatch)

  async function handleCreate() {
    if (!onCreate || !trimmedQuery) return
    setIsCreating(true)
    try {
      const created = await onCreate(trimmedQuery)
      onChange(created.value)
      setOpen(false)
    } catch {
      // onCreate is expected to surface its own error (e.g. a toast) - swallow here
      // just to avoid an unhandled rejection; the dropdown stays open so the user
      // can retry or pick an existing option instead.
    } finally {
      setIsCreating(false)
    }
  }

  function handleFocus() {
    setOpen(true)
    if (selected) setQuery('')
  }

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          placeholder={placeholder}
          value={query}
          onFocus={handleFocus}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />

        {open && (
          <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {filtered.length === 0 && !showCreate && (
              <p className="px-3 py-2 text-sm text-slate-400">{emptyMessage}</p>
            )}
            {filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50',
                  option.value === value && 'bg-brand-50 text-brand-700',
                )}
              >
                <span className="truncate">
                  {option.label}
                  {option.sublabel && <span className="ml-1 text-xs text-slate-400">{option.sublabel}</span>}
                </span>
                {option.value === value && <Check className="size-4 shrink-0" />}
              </button>
            ))}
            {showCreate && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={isCreating}
                className="flex w-full items-center gap-1.5 border-t border-slate-100 px-3 py-2 text-left text-sm font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50"
              >
                <Plus className="size-3.5" />
                {isCreating ? 'Adding…' : createLabel ? createLabel(trimmedQuery) : `Add "${trimmedQuery}"`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
