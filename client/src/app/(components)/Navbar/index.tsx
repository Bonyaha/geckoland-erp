'use client'

import { Bell, Settings } from 'lucide-react'
import Link from 'next/link'
import React from 'react'
import UserMenu from '@/app/(components)/UserMenu'
import { getUserData } from '@/utils/authUtils'

const Navbar = () => {
  // Get user data from localStorage
  const userData = getUserData()
  const userName = userData?.name || 'User'

  return (
    <div className='flex justify-between items-center w-full mb-7'>
      {/* LEFT SIDE */}
      <div className='flex justify-between items-center gap-5'>
        <div className='relative'>
          <input
            type='search'
            placeholder='Start type to search groups & products'
            className='pl-10 pr-4 py-2 w-50 md:w-60 border-2 border-gray-300 bg-white rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:focus:border-blue-400 dark:text-gray-50'
          />

          <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-non'>
            <Bell className='text-gray-500 dark:text-gray-400' size={20} />
          </div>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className='flex justify-between items-center gap-5'>
        <div className='hidden md:flex justify-between items-center gap-5'>
          <div className='relative'>
            <Bell
              className='cursor-pointer text-gray-500 dark:text-gray-400'
              size={24}
            />
            <span className='absolute -top-2 -right-2 inline-flex items-center justify-center px-[0.4rem] py-1 text-xs font-semibold leading-none text-red-100 bg-red-400 rounded-full'>
              3
            </span>
          </div>
          <hr className='w-0 h-7 border border-solid border-l border-gray-300 dark:border-gray-600 mx-3' />

          {/* User Menu */}
          <UserMenu userName={userName} />
        </div>
        <Link href='/settings'>
          <Settings
            className='cursor-pointer text-gray-500 dark:text-gray-400'
            size={24}
          />
        </Link>
      </div>
    </div>
  )
}

export default Navbar
