// client/src/app/(components)/Sidebar/index.tsx
'use client'

import {
  ShoppingCart,
  Wallet,
  Package,
  Layout,
  LucideIcon,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  User,
  Circle,
} from 'lucide-react'
import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/redux'
import { setIsSidebarCollapsed } from '@/state'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

interface SidebarLinkProps {
  href: string
  icon: LucideIcon
  label: string
  isCollapsed: boolean
  badgeCount?: number
  hasSubmenu?: boolean
  isOpen?: boolean
  onToggle?: () => void
}

const SidebarLink = ({
  href,
  icon: Icon,
  label,
  isCollapsed,
  badgeCount,
  hasSubmenu,
  isOpen,
  onToggle,
}: SidebarLinkProps) => {
  const pathname = usePathname()
  const isActive =
    pathname === href || (pathname === '/' && href === '/dashboard')

  const content = (
    <div
      className={`cursor-pointer flex items-center relative ${
        isCollapsed ? 'justify-center py-4' : 'justify-between px-6 py-3'
      } transition-all duration-200 rounded-lg mx-2 ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'text-gray-400 hover:text-white hover:bg-gray-800'
      }`}
      onClick={hasSubmenu ? onToggle : undefined}
    >
      <div className='flex items-center gap-3'>
        <Icon className={`${isCollapsed ? 'w-6 h-6' : 'w-5 h-5'}`} />
        {!isCollapsed && <span className='font-medium text-sm'>{label}</span>}
      </div>

      {!isCollapsed && (
        <div className='flex items-center gap-2'>
          {badgeCount !== undefined && badgeCount > 0 && (
            <span className='bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full'>
              {badgeCount}
            </span>
          )}
          {hasSubmenu &&
            (isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
        </div>
      )}
    </div>
  )

  return hasSubmenu ? content : <Link href={href}>{content}</Link>
}

const Sidebar = () => {
  const dispatch = useAppDispatch()
  const isSidebarCollapsed = useAppSelector(
    (state) => state.global.isSidebarCollapsed
  )
  const [isOrdersOpen, setIsOrdersOpen] = useState(true) // Default open to match image

  const sidebarClassNames = `fixed flex flex-col ${
    isSidebarCollapsed ? 'w-0 md:w-20' : 'w-64'
  } bg-[#111827] transition-all duration-300 overflow-hidden h-full shadow-md z-40 border-r border-gray-800`

  return (
    <div className={sidebarClassNames}>
      {/* LOGO */}
      <div
        className={`flex items-center gap-3 pt-8 ${
          isSidebarCollapsed ? 'justify-center' : 'px-8'
        }`}
      >
        <div className='bg-blue-600 p-1.5 rounded-lg'>
          <Package className='w-6 h-6 text-white' />
        </div>
        {!isSidebarCollapsed && (
          <h1 className='font-bold text-xl text-white'>Склад</h1>
        )}
      </div>

      {/* NAV LINKS */}
      <div className='flex-grow mt-8 space-y-1'>
        <SidebarLink
          href='/dashboard'
          icon={Layout}
          label='Головна'
          isCollapsed={isSidebarCollapsed}
        />

        {/* ORDERS WITH SUBMENU */}
        <SidebarLink
          href='/orders'
          icon={ShoppingCart}
          label='Замовлення'
          isCollapsed={isSidebarCollapsed}
          badgeCount={5}
          hasSubmenu={!isSidebarCollapsed}
          isOpen={isOrdersOpen}
          onToggle={() => setIsOrdersOpen(!isOrdersOpen)}
        />

        {!isSidebarCollapsed && isOrdersOpen && (
          <div className='ml-12 space-y-1 mt-1 transition-all duration-300'>
            {[
              'Всі замовлення',
              'Прийняті',
              'В роботі',
              'Відправлені',
              'Виконані',
              'Відмінені',
            ].map((sub) => (
              <Link
                key={sub}
                href={`/orders/${sub}`}
                className='block py-2 text-sm text-gray-400 hover:text-white transition-colors'
              >
                {sub}
              </Link>
            ))}
          </div>
        )}

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
          href='/expenses'
          icon={Wallet}
          label='Витрати'
          isCollapsed={isSidebarCollapsed}
        />

        <div className='pt-4 border-t border-gray-800 mx-4' />

        <SidebarLink
          href='/settings'
          icon={SlidersHorizontal}
          label='Налаштування'
          isCollapsed={isSidebarCollapsed}
        />
      </div>

      {/* FOOTER */}
      {!isSidebarCollapsed && (
        <div className='mb-8 px-8'>
          <p className='text-xs text-gray-500'>© 2026 SkladPro CRM</p>
        </div>
      )}
    </div>
  )
}

export default Sidebar
