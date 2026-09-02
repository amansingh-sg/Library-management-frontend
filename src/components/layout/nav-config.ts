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
import { Permission, Role } from '@/types/enums'

export interface NavItem {
  label: string
  to: string
  icon: ComponentType<{ className?: string }>
  anyOf?: Permission[]
  // Hides this item for the given roles even if they hold the required permission -
  // e.g. STAFF/LIBRARIAN/SUPER_ADMIN inherit VIEW_OWN_LOANS from MEMBER, but should
  // see the all-members "Loans" management view instead of a personal "My Loans"
  // page. STAFF's read-only "circulation desk" view (VIEW_ALL_LOANS/
  // VIEW_ALL_RESERVATIONS/VIEW_ALL_FAVOURITES - see FixStaffLibraryVisibility
  // migration) already surfaces the equivalent libraryNav items below, so hiding
  // these doesn't leave STAFF without a way to see loans/reservations/favourites.
  hiddenForRoles?: Role[]
}

const STAFF_AND_ABOVE = [Role.STAFF, Role.LIBRARIAN, Role.SUPER_ADMIN]

export const memberNav: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Books', to: '/books', icon: BookOpen, anyOf: [Permission.VIEW_BOOKS] },
  {
    label: 'My Loans',
    to: '/my-loans',
    icon: Library,
    anyOf: [Permission.VIEW_OWN_LOANS],
    hiddenForRoles: STAFF_AND_ABOVE,
  },
  {
    label: 'My Reservations',
    to: '/my-reservations',
    icon: CalendarClock,
    anyOf: [Permission.VIEW_OWN_RESERVATIONS],
    hiddenForRoles: STAFF_AND_ABOVE,
  },
  {
    label: 'Favourites',
    to: '/favourites',
    icon: Heart,
    hiddenForRoles: STAFF_AND_ABOVE,
  },
  {
    label: 'My Analytics',
    to: '/my-analytics',
    icon: BarChart3,
    // Same reasoning as the personal loans/reservations/favourites pages above -
    // STAFF/LIBRARIAN/SUPER_ADMIN see the library-wide Analytics page (analyticsNav
    // below) instead of a personal one.
    hiddenForRoles: STAFF_AND_ABOVE,
  },
]

export const libraryNav: NavItem[] = [
  {
    label: 'Loans',
    to: '/loans',
    icon: Library,
    anyOf: [Permission.MANAGE_LOANS, Permission.VIEW_ALL_LOANS],
  },
  {
    label: 'Reservations',
    to: '/reservations',
    icon: CalendarClock,
    anyOf: [Permission.MANAGE_RESERVATIONS, Permission.VIEW_ALL_RESERVATIONS],
  },
  {
    label: 'Favourites',
    to: '/favourites-overview',
    icon: Heart,
    anyOf: [Permission.VIEW_LIBRARY_ANALYTICS, Permission.VIEW_ALL_FAVOURITES],
  },
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
  { label: 'Analytics', to: '/analytics', icon: BarChart3, anyOf: [Permission.VIEW_LIBRARY_ANALYTICS] },
]
