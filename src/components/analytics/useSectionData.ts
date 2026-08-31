import { useCallback, useEffect, useState } from 'react'
import { getErrorMessage } from '@/api/client'

interface SectionState<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  reload: () => void
}

// Small per-section async fetch helper scoped to the analytics dashboard, so one slow
// or 403'd section never blocks/blanks the rest of the page.
export function useSectionData<T>(fetcher: () => Promise<T>, deps: unknown[] = []): SectionState<T> {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    fetcher()
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load this section.'))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey])

  useEffect(() => load(), [load])

  return { data, isLoading, error, reload: () => setReloadKey((k) => k + 1) }
}
