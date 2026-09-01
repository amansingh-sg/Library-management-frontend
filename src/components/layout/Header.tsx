import { Menu as MenuIcon, ChevronDown, LogOut } from 'lucide-react'
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/utils/cn'

const roleTone: Record<string, 'purple' | 'blue' | 'green' | 'slate'> = {
  SUPER_ADMIN: 'purple',
  LIBRARIAN: 'blue',
  MEMBER: 'slate',
}

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '??'

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label="Open menu"
        >
          <MenuIcon className="size-5" />
        </button>
        <h1 className="text-sm font-semibold text-slate-500">Library Management System</h1>
      </div>

      <Menu as="div" className="relative">
        <MenuButton className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100">
          <div className="flex size-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
            {initials}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-medium text-slate-900">{user?.email}</p>
          </div>
          {user && <Badge tone={roleTone[user.role] ?? 'slate'}>{user.role}</Badge>}
          <ChevronDown className="size-4 text-slate-400" />
        </MenuButton>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <MenuItems className="absolute right-0 z-50 mt-2 w-48 origin-top-right rounded-lg border border-slate-200 bg-white py-1 shadow-lg focus:outline-none">
            <MenuItem>
              {({ focus }) => (
                <button
                  onClick={() => {
                    logout()
                    navigate('/login')
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700',
                    focus && 'bg-slate-50',
                  )}
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
              )}
            </MenuItem>
          </MenuItems>
        </Transition>
      </Menu>
    </header>
  )
}
