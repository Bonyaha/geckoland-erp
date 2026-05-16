'use client'

import Navbar from '@/app/(components)/Navbar'
import Sidebar from '@/app/(components)/Sidebar'
import StoreProvider, { useAppSelector } from './redux'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getValidToken } from '@/utils/authUtils'

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

  // check token validity on mount and whenever isAuthenticated changes
  useEffect(() => {
    if (pathname === '/login') return
    const token = getValidToken()
    if (!token) {
      setSessionExpired(true)
    }
  }, [pathname])

  // redirect to login after showing the expired message
  useEffect(() => {
    if (!sessionExpired) return
    const timer = setTimeout(() => router.push('/login'), 3000)
    return () => clearTimeout(timer)
  }, [sessionExpired, router])

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
          <p className='text-xs text-gray-400'>Перенаправлення на сторінку входу...</p>
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
