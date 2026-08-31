import {
  BarChart3,
  BookOpen,
  CalendarClock,
  Heart,
  LayoutDashboard,
  Library,
  ShieldCheck,
  Users,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { Permission } from '@/types/enums'

export interface NavItem {
  label: string
  to: string
  icon: ComponentType<{ className?: string }>
  anyOf?: Permission[]
}

export const memberNav: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Books', to: '/books', icon: BookOpen, anyOf: [Permission.VIEW_BOOKS] },
  { label: 'My Loans', to: '/my-loans', icon: Library, anyOf: [Permission.VIEW_OWN_LOANS] },
  {
    label: 'My Reservations',
    to: '/my-reservations',
    icon: CalendarClock,
    anyOf: [Permission.VIEW_OWN_RESERVATIONS],
  },
  { label: 'Favourites', to: '/favourites', icon: Heart },
]

export const adminNav: NavItem[] = [
  { label: 'Users', to: '/admin/users', icon: Users, anyOf: [Permission.MANAGE_USERS, Permission.MANAGE_MEMBERS] },
  {
    label: 'Roles & Permissions',
    to: '/admin/permissions',
    icon: ShieldCheck,
    anyOf: [Permission.MANAGE_ROLE_PERMISSIONS],
  },
]

export const analyticsNav: NavItem[] = [
  { label: 'Analytics', to: '/analytics', icon: BarChart3, anyOf: [Permission.MANAGE_BOOKS] },
]
