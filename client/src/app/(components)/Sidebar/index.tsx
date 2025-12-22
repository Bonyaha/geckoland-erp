//client/src/app/(components)/Sidebar/index.tsx
'use client'

import {
  Archive,
  CircleDollarSign,
  Package,
  Layout,
  LucideIcon,
  Menu,
  SlidersHorizontal,
  User,
} from 'lucide-react'
import React from 'react'
import { useAppDispatch, useAppSelector } from '@/app/redux'
import { setIsSidebarCollapsed } from '@/state'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

interface SidebarLinkProps {
  href: string
  icon: LucideIcon
  label: string
  isCollapsed: boolean
}

const SidebarLink = ({
  href,
  icon: Icon,
  label,
  isCollapsed,
}: SidebarLinkProps) => {
  const pathname = usePathname()
  const isActive =
    pathname === href || (pathname === '/' && href === '/dashboard')

  return (
    <Link href={href}>
      <div
        className={`cursor-pointer flex items-center ${
          isCollapsed ? 'justify-center py-4' : 'justify-start px-8 py-4'
        } gap-3 transition-colors ${
          isActive
            ? 'bg-blue-600 text-white' // Active state: Blue background, White text, NO HOVER bg
            : 'text-gray-200 hover:bg-white hover:text-black' // Inactive state: Gray text, HOVER effects applied
        }`}
      >
        {/* Updated icon color to inherit from parent text color */}
        <Icon className='w-6 h-6' />

        <span
          className={`${isCollapsed ? 'hidden' : 'block'} font-medium text-lg`}
        >
          {label}
        </span>
      </div>
    </Link>
  )
}

const Sidebar = () => {
  const dispatch = useAppDispatch()
  const isSidebarCollapsed = useAppSelector(
    (state) => state.global.isSidebarCollapsed
  )

  const toggleSidebar = () => {
    dispatch(setIsSidebarCollapsed(!isSidebarCollapsed))
  }

  const sidebarClassNames = `fixed flex flex-col ${
    isSidebarCollapsed ? 'w-0 md:w-16' : 'w-72 md:w-64'
  } bg-[#383a3d] transition-all duration-300 overflow-hidden h-full shadow-md z-40`

  return (
    <div className={sidebarClassNames}>
      {/* TOP LOGO & TOGGLE SECTION*/}
      <div
        className={`flex gap-3 items-center pt-8 ${
          isSidebarCollapsed ? 'justify-center' : 'px-8'
        }`}
      >
        <button
          className='p-3 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors cursor-pointer'
          onClick={toggleSidebar}
        >
          <Menu className='w-7 h-7 text-white' />
        </button>

        {/* LOGO AND TEXT - Hidden when collapsed to save space */}
        {!isSidebarCollapsed && (
          <div className='flex items-center gap-3'>
            <div className='text-white'>
              <Image
                src='/logo.png'
                alt='warehouse logo'
                width={27}
                height={27}
                className='rounded w-8'
              />
            </div>
            <h1 className='font-extrabold text-2xl text-white whitespace-nowrap'>
              Склад
            </h1>
          </div>
        )}
      </div>

      {/* LINKS */}
      <div className='flex-grow mt-8'>
        <SidebarLink
          href='/dashboard'
          icon={Layout}
          label='Головна'
          isCollapsed={isSidebarCollapsed}
        />
        <SidebarLink
          href='/inventory'
          icon={Archive}
          label='Замовлення'
          isCollapsed={isSidebarCollapsed}
        />
        <SidebarLink
          href='/products'
          icon={Package}
          label='Товари'
          isCollapsed={isSidebarCollapsed}
        />
        <SidebarLink
          href='/users'
          icon={User}
          label='Клієнти'
          isCollapsed={isSidebarCollapsed}
        />
        <SidebarLink
          href='/settings'
          icon={SlidersHorizontal}
          label='Налаштування'
          isCollapsed={isSidebarCollapsed}
        />
        <SidebarLink
          href='/expenses'
          icon={CircleDollarSign}
          label='Витрати'
          isCollapsed={isSidebarCollapsed}
        />
      </div>

      {/* FOOTER */}
      <div className={`${isSidebarCollapsed ? 'hidden' : 'block'} mb-10`}>
        <p className='text-center text-xs text-gray-400'>
          &copy; 2025 Склад. Всі права захищені.
        </p>
      </div>
    </div>
  )
}

export default Sidebar
