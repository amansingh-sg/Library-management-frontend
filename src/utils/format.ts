export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isNaN(num) ? 0 : num
}

export function daysUntil(value: string): number {
  const diffMs = new Date(value).getTime() - Date.now()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}
