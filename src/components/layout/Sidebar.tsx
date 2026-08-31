import { NavLink } from 'react-router-dom'
import { BookMarked, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { adminNav, analyticsNav, memberNav, type NavItem } from './nav-config'
import { cn } from '@/utils/cn'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

function NavSection({ title, items }: { title?: string; items: NavItem[] }) {
  const { hasPermission } = useAuth()
  const visible = items.filter((item) => !item.anyOf || hasPermission(...item.anyOf))
  if (visible.length === 0) return null

  return (
    <div className="flex flex-col gap-1">
      {title && <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>}
      {visible.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
            )
          }
        >
          <item.icon className="size-4 shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </div>
  )
}

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 px-3 py-4 transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-2 pb-4">
          <div className="flex items-center gap-2 text-white">
            <BookMarked className="size-6 text-brand-400" />
            <span className="text-lg font-semibold">Athenaeum</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white lg:hidden" aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto">
          <NavSection items={memberNav} />
          <NavSection title="Analytics" items={analyticsNav} />
          <NavSection title="Administration" items={adminNav} />
        </nav>
      </aside>
    </>
  )
}
