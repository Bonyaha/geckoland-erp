// client/src/app/(components)/Sidebar/index.tsx
'use client'

import {
  ShoppingCart,
  Wallet,
  Package,
  Home,
  LucideIcon,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  SlidersHorizontal,
  Users,
} from 'lucide-react'
import React, { useState } from 'react'
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
          ? 'bg-[#5a5a70] text-white'
          : 'text-[#b8b8c8] hover:text-white hover:bg-[#52526a]'
      }`}
      onClick={hasSubmenu ? onToggle : undefined}
    >
      <div className='flex items-center gap-3'>
        <Icon className={`${isCollapsed ? 'w-6 h-6' : 'w-5 h-5'}`} />
        {!isCollapsed && (
          <span className='font-normal text-[15px]'>{label}</span>
        )}
      </div>

      {!isCollapsed && (
        <div className='flex items-center gap-2'>
          {badgeCount !== undefined && badgeCount > 0 && (
            <span className='bg-white text-[#45455c] text-[11px] font-semibold px-2 py-0.5 rounded-md min-w-[24px] text-center'>
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
    (state) => state.global.isSidebarCollapsed,
  )
  const [isOrdersOpen, setIsOrdersOpen] = useState(true)

  const toggleSidebar = () => {
    dispatch(setIsSidebarCollapsed(!isSidebarCollapsed))
  }

  const sidebarClassNames = `fixed flex flex-col ${
    isSidebarCollapsed ? 'w-0 md:w-20' : 'w-64'
  } bg-[#45455c] transition-all duration-300 overflow-hidden h-full shadow-md z-40 border-r border-[#52526a]`

  return (
    <div className={sidebarClassNames}>
      {/* LOGO */}
      <div
        className={`flex items-center gap-3 pt-8 pb-6 ${
          isSidebarCollapsed ? 'justify-center' : 'px-8'
        }`}
      >
        <div className='flex items-center justify-center w-9 h-9'>
          <Image
            src='/logo.png'
            alt='Logo'
            width={36} // Increased from 24 to 36 to fill the container
            height={36} // Increased from 24 to 36
            className='object-contain'
          />
        </div>
        {!isSidebarCollapsed && (
          <h1 className='font-bold text-xl text-white'>Склад</h1>
        )}
      </div>
      {!isSidebarCollapsed && (
        <div className='mx-6 mb-4 border-t border-[#5a5a70]'></div>
      )}

      {/* NAV LINKS */}
      <div className='flex-grow mt-8 space-y-1'>
        <SidebarLink
          href='/dashboard'
          icon={Home}
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
            <Link
              href='/orders'
              className='block py-2 text-[14px] text-[#b8b8c8] hover:text-white transition-colors'
            >
              Всі замовлення
            </Link>
            <Link
              href='/orders?status=RECEIVED'
              className='block py-2 text-[14px] text-[#b8b8c8] hover:text-white transition-colors'
            >
              Нові
            </Link>
            <Link
              href='/orders?status=PREPARED'
              className='block py-2 text-[14px] text-[#b8b8c8] hover:text-white transition-colors'
            >
              Зібрані
            </Link>
            <Link
              href='/orders?status=SHIPPED'
              className='block py-2 text-[14px] text-[#b8b8c8] hover:text-white transition-colors'
            >
              Відправлені
            </Link>
            <Link
              href='/orders?status=DELIVERED'
              className='block py-2 text-[14px] text-[#b8b8c8] hover:text-white transition-colors'
            >
              Доставлені
            </Link>
            <Link
              href='/orders?status=CANCELED'
              className='block py-2 text-[14px] text-[#b8b8c8] hover:text-white transition-colors'
            >
              Скасовані
            </Link>
            <Link
              href='/orders/create'
              className='block py-2 text-[14px] text-[#b8b8c8] hover:text-white transition-colors'
            >
              Створити замовлення
            </Link>
          </div>
        )}

        <SidebarLink
          href='/products'
          icon={Package}
          label='Товари'
          isCollapsed={isSidebarCollapsed}
        />
        <SidebarLink
          href='/clients'
          icon={Users}
          label='Клієнти'
          isCollapsed={isSidebarCollapsed}
        />
        <SidebarLink
          href='/expenses'
          icon={Wallet}
          label='Витрати'
          isCollapsed={isSidebarCollapsed}
        />

        <div className='mx-6 mb-4 border-t border-[#5a5a70]' />

        <SidebarLink
          href='/settings'
          icon={SlidersHorizontal}
          label='Налаштування'
          isCollapsed={isSidebarCollapsed}
        />
      </div>

      {/* FOOTER */}
      {!isSidebarCollapsed ? (
        <div className='px-8'>
          <button
            onClick={toggleSidebar}
            className='flex items-center gap-2 text-[#b8b8c8] hover:text-white transition-colors text-[14px] cursor-pointer'
          >
            <ArrowLeft className='w-4 h-4' />
            <span>Приховати</span>
          </button>
        </div>
      ) : (
        <div className='flex justify-center'>
          <button
            onClick={toggleSidebar}
            className='p-3 text-[#b8b8c8] hover:text-white hover:bg-[#52526a] rounded-lg transition-colors cursor-pointer'
            title='Розгорнути'
          >
            <ArrowRight className='w-5 h-5' />
          </button>
        </div>
      )}
    </div>
  )
}

export default Sidebar
