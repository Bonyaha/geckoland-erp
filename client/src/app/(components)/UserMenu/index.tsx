// client/src/app/(components)/UserMenu/index.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { LogOut, ExternalLink, User } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { removeAuthToken } from '@/utils/authUtils'
import ThemeToggle from '@/app/theme-toggle'

interface UserMenuProps {
  userName: string
}

const UserMenu = ({ userName }: UserMenuProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleLogout = () => {
    removeAuthToken()
    router.push('/login')
  }

  return (
    <div className='relative' ref={menuRef}>
      {/* User name button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer'
      >
        <div className='w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center'>
          <User className='w-5 h-5 text-white' />
        </div>
        <span className='font-semibold text-gray-900 dark:text-gray-50'>
          {userName}
        </span>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className='absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50'>
          {/* Website link */}
          <a
            href='https://southgeckoland.com.ua/'
            target='_blank'
            rel='noopener noreferrer'
            className='flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer'
          >
            <ExternalLink className='w-5 h-5 text-gray-600 dark:text-gray-400' />
            <div className='flex-1'>
              <div className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                Геколенд
              </div>
              <div className='text-xs text-gray-500 dark:text-gray-400'>
                Товари для екзотичних тварин
              </div>
            </div>
          </a>

          {/* Divider */}
          <div className='my-2 border-t border-gray-200 dark:border-gray-700' />

          {/* Theme toggle */}
          <div className='flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'>
            <div className='flex items-center gap-3'>
              <div className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                Тема
              </div>
            </div>
            <ThemeToggle />
          </div>

          {/* Divider */}
          <div className='my-2 border-t border-gray-200 dark:border-gray-700' />

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className='flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer text-red-600 dark:text-red-400'
          >
            <LogOut className='w-5 h-5' />
            <span className='text-sm font-medium'>Вихід</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default UserMenu
