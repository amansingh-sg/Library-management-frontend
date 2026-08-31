import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface Column<T> {
  header: string
  accessor: (row: T) => ReactNode
  className?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
}

export function Table<T>({ columns, data, rowKey, onRowClick }: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-max border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {columns.map((col) => (
              <th key={col.header} className={cn('whitespace-nowrap px-4 py-3 font-semibold text-slate-600', col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              className={cn(
                'border-b border-slate-100 last:border-0',
                onRowClick && 'cursor-pointer hover:bg-slate-50',
              )}
            >
              {columns.map((col) => (
                <td key={col.header} className={cn('whitespace-nowrap px-4 py-3 text-slate-700', col.className)}>
                  {col.accessor(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
