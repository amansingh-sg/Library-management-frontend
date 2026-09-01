import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { RequirePermission } from '@/routes/RequirePermission'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Permission } from '@/types/enums'

import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import VerifyEmailPage from '@/pages/auth/VerifyEmailPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import DashboardPage from '@/pages/member/DashboardPage'
import BooksPage from '@/pages/member/BooksPage'
import BookDetailsPage from '@/pages/member/BookDetailsPage'
import MyLoansPage from '@/pages/member/MyLoansPage'
import MyReservationsPage from '@/pages/member/MyReservationsPage'
import FavouritesPage from '@/pages/member/FavouritesPage'
import LoansManagementPage from '@/pages/library/LoansManagementPage'
import ReservationsManagementPage from '@/pages/library/ReservationsManagementPage'
import UsersPage from '@/pages/admin/UsersPage'
import RolePermissionsPage from '@/pages/admin/RolePermissionsPage'
import AnalyticsPage from '@/pages/analytics/AnalyticsPage'
import NotFound from '@/pages/NotFound'
import Forbidden from '@/pages/Forbidden'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/user-email-verification/:uniqueKey" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/books" element={<BooksPage />} />
              <Route path="/books/:id" element={<BookDetailsPage />} />
              <Route path="/my-loans" element={<MyLoansPage />} />
              <Route path="/my-reservations" element={<MyReservationsPage />} />
              <Route path="/favourites" element={<FavouritesPage />} />

              <Route
                path="/loans"
                element={
                  <RequirePermission anyOf={[Permission.MANAGE_LOANS]}>
                    <LoansManagementPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/reservations"
                element={
                  <RequirePermission anyOf={[Permission.MANAGE_RESERVATIONS]}>
                    <ReservationsManagementPage />
                  </RequirePermission>
                }
              />

              <Route
                path="/admin/users"
                element={
                  <RequirePermission anyOf={[Permission.MANAGE_USERS, Permission.MANAGE_MEMBERS]}>
                    <UsersPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/admin/permissions"
                element={
                  <RequirePermission anyOf={[Permission.MANAGE_ROLE_PERMISSIONS]}>
                    <RolePermissionsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="/analytics"
                element={
                  <RequirePermission anyOf={[Permission.MANAGE_BOOKS]}>
                    <AnalyticsPage />
                  </RequirePermission>
                }
              />

              <Route path="/403" element={<Forbidden />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
