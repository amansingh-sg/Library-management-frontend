import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function Forbidden() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-24 text-center">
      <ShieldAlert className="size-12 text-red-400" />
      <p className="text-lg font-semibold text-slate-900">Access denied</p>
      <p className="max-w-sm text-sm text-slate-500">
        You don't have permission to view this page. Contact an administrator if you believe this is a mistake.
      </p>
      <Link to="/">
        <Button className="mt-2">Back to dashboard</Button>
      </Link>
    </div>
  )
}
