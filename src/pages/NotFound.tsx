import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-24 text-center">
      <p className="text-5xl font-bold text-slate-300">404</p>
      <p className="text-lg font-semibold text-slate-900">Page not found</p>
      <p className="text-sm text-slate-500">The page you're looking for doesn't exist or has moved.</p>
      <Link to="/">
        <Button className="mt-2">Back to dashboard</Button>
      </Link>
    </div>
  )
}
