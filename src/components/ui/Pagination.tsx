import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { PaginatedResponse } from '@/types/models'

interface PaginationProps {
  page: PaginatedResponse<unknown>
  onPageChange: (page: number) => void
  isLoading?: boolean
}

export function Pagination({ page, onPageChange, isLoading }: PaginationProps) {
  if (page.last_page <= 1) return null

  return (
    <div className="flex items-center justify-between gap-4 border-t border-slate-100 px-1 py-3 text-sm text-slate-500">
      <p>
        Showing <span className="font-medium text-slate-700">{page.from ?? 0}</span>–
        <span className="font-medium text-slate-700">{page.to ?? 0}</span> of{' '}
        <span className="font-medium text-slate-700">{page.total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!page.prev_page || isLoading}
          onClick={() => page.prev_page && onPageChange(page.prev_page)}
        >
          <ChevronLeft className="size-3.5" />
          Previous
        </Button>
        <span className="px-1 text-xs text-slate-400">
          Page {page.current_page} of {page.last_page}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={!page.next_page || isLoading}
          onClick={() => page.next_page && onPageChange(page.next_page)}
        >
          Next
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
