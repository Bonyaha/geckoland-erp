// Component to orchestrate layout wrapping and route protection
'use client'

import { usePathname } from 'next/navigation'
import DashboardWrapper from '@/app/dashboardWrapper'
import ProtectedRoute from './ProtectedRoute'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'

  // If we are on the login page, don't wrap it with protection or the dashboard layout
  if (isLoginPage) {
    return <>{children}</>
  }

  // Wrap all other routes with protection AND the dashboard layout
  return (
    <ProtectedRoute>
      <DashboardWrapper>{children}</DashboardWrapper>
    </ProtectedRoute>
  )
}
