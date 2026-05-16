'use client'

import Navbar from '@/app/(components)/Navbar'
import Sidebar from '@/app/(components)/Sidebar'
import StoreProvider, { useAppSelector } from './redux'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getValidToken } from '@/utils/authUtils'
import { useTokenExpiry } from '@/hooks/useTokenExpiry'

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const isSidebarCollapsed = useAppSelector(
    (state) => state.global.isSidebarCollapsed,
  )
  /*   const isAuthenticated = useAppSelector(
    (state) => state.global.isAuthenticated,
  ) */
  const router = useRouter()
  const pathname = usePathname()
  const [sessionExpired, setSessionExpired] = useState(false)

  // stable callback so the hook's event listeners don't re-register on every render
  const handleExpired = useCallback(() => {
    setSessionExpired(true)
  }, [])

  // Method 1 — countdown timer
  const { scheduleExpiry, clearTimer } = useTokenExpiry(handleExpired)

  // Method 2 — listen for the CustomEvent fired by the API interceptor
  useEffect(() => {
    const handleAuthExpiredEvent = () => {
      clearTimer() // cancel the countdown (already expired)
      setSessionExpired(true)
    }

    window.addEventListener('auth:expired', handleAuthExpiredEvent)
    return () =>
      window.removeEventListener('auth:expired', handleAuthExpiredEvent)
  }, [clearTimer])

  // check token validity on mount and whenever isAuthenticated changes
  useEffect(() => {
    if (pathname === '/login') return
    const token = getValidToken()
    if (!token) {
      setSessionExpired(true)
    }
    scheduleExpiry()
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // redirect to login after showing the expired message
  useEffect(() => {
    if (!sessionExpired) return
    const timer = setTimeout(() => router.push('/login'), 3000)
    return () => clearTimeout(timer)
  }, [sessionExpired, router])

  // Cleanup timer when component unmounts
  useEffect(() => {
    return () => clearTimer()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // skip auth checks entirely on the login page
  if (pathname === '/login') {
    return <>{children}</>
  }

  // session expired overlay shown before redirect
  if (sessionExpired) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900'>
        <div className='text-center p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg max-w-sm w-full'>
          <div className='text-4xl mb-4'>🔒</div>
          <h2 className='text-xl font-bold text-gray-800 dark:text-white mb-2'>
            Сесія завершена
          </h2>
          <p className='text-gray-500 dark:text-gray-400 text-sm mb-4'>
            Час дії вашого токену вийшов. Будь ласка, увійдіть знову.
          </p>
          <p className='text-xs text-gray-400'>
            Перенаправлення на сторінку входу...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex dark:bg-black bg-gray-50 text-gray-900 w-full min-h-screen `}
    >
      <Sidebar />
      <main
        className={`flex flex-col w-full h-full py-7 px-9 bg-gray-50  ${
          isSidebarCollapsed ? 'md:pl-24' : 'md:pl-72'
        } dark:bg-gray-900`}
      >
        <Navbar />
        {children}
      </main>
    </div>
  )
}

const DashboardWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <StoreProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </StoreProvider>
  )
}

export default DashboardWrapper
