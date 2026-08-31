import { Outlet } from 'react-router-dom'
import { BookMarked } from 'lucide-react'

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2 text-slate-900">
          <BookMarked className="size-8 text-brand-600" />
          <span className="text-2xl font-semibold">Athenaeum</span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
