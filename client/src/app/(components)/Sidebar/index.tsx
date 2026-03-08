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
import React, { useState, useRef, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/redux'
import { setIsSidebarCollapsed } from '@/state'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useOrderCounts } from '@/hooks/useOrderCounts' 

interface SidebarLinkProps {
  href: string
  icon: LucideIcon
  label: string
  isCollapsed: boolean
  hasSubmenu?: boolean
  isOpen?: boolean
  onToggle?: () => void
}

const SidebarLink = ({
  href,
  icon: Icon,
  label,
  isCollapsed,
  hasSubmenu,
  isOpen,
  onToggle,
}: SidebarLinkProps) => {
  const pathname = usePathname()
  const isActive =
    pathname === href || (pathname === '/' && href === '/dashboard')

  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipY, setTooltipY] = useState(0)
  const linkRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)
const orderCounts = useOrderCounts() 

  useEffect(() => {
    if (linkRef.current) {
      const rect = linkRef.current.getBoundingClientRect()
      setTooltipY(rect.top + rect.height / 2)
    }
  }, [showTooltip])

  // Check if this is the Orders link with submenu
  const isOrdersLink = href === '/orders' && isCollapsed

  const handleMouseEnter = () => {
    if (isCollapsed) {
      // Clear any pending hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
        hideTimeoutRef.current = null
      }
      setShowTooltip(true)
    }
  }

  const handleMouseLeave = () => {
    // Add a small delay before hiding to allow mouse to reach tooltip
    hideTimeoutRef.current = setTimeout(() => {
      setShowTooltip(false)
    }, 100)
  }

  const handleTooltipMouseEnter = () => {
    // Clear hide timeout when mouse enters tooltip
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
  }

  const handleTooltipMouseLeave = () => {
    setShowTooltip(false)
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [])

  const linkContent = (
    <div
      ref={linkRef}
      className={`cursor-pointer flex items-center ${
        isCollapsed ? 'justify-center py-4' : 'justify-between px-6 py-3'
      } transition-all duration-200 rounded-lg mx-2 ${
        isActive
          ? 'bg-[#5a5a70] text-white'
          : 'text-[#b8b8c8] hover:text-white hover:bg-[#52526a]'
      }`}
      onClick={hasSubmenu ? onToggle : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className='flex items-center gap-3'>
        <Icon className={`${isCollapsed ? 'w-6 h-6' : 'w-5 h-5'}`} />
        {!isCollapsed && (
          <span className='font-normal text-[15px]'>{label}</span>
        )}
      </div>

      {!isCollapsed && hasSubmenu && (
        <div className='flex items-center gap-2'>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Main link - only wrap in Link if not a submenu item */}
      {hasSubmenu ? linkContent : <Link href={href}>{linkContent}</Link>}

      {/* TOOLTIP: Simple tooltip for non-Orders links */}
      {isCollapsed && showTooltip && !isOrdersLink && (
        <div
          className='fixed left-[84px] px-3 py-2 bg-gray-800 text-white text-sm rounded-md whitespace-nowrap z-[9999] shadow-xl transition-opacity duration-150'
          style={{
            top: `${tooltipY}px`, // Positioned at the calculated Y
            transform: 'translateY(-50%)', // Centered vertically
            opacity: showTooltip ? 1 : 0, // Fade in
          }}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        >
          {label}
          {/* Arrow pointing to the icon */}
          <div className='absolute top-1/2 -left-1.5 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[6px] border-r-gray-800'></div>
        </div>
      )}

      {/* SUBMENU TOOLTIP: For Orders link when collapsed */}
      {isCollapsed && showTooltip && isOrdersLink && (
        <div
          ref={tooltipRef}
          className='fixed left-[84px] py-2 bg-gray-800 text-white text-sm rounded-md z-[9999] shadow-xl min-w-[200px] transition-opacity duration-150'
          style={{
            top: `${tooltipY}px`,
            transform: 'translateY(-50%)',
            opacity: showTooltip ? 1 : 0,
          }}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        >
          {/* Header */}
          <div className='px-3 py-1 font-semibold border-b border-gray-700 mb-1'>
            {label}
          </div>

          {/* Submenu items */}
          <div className='py-1'>
            <SubmenuTooltipItem
              href='/orders'
              label='Всі замовлення'
              count={orderCounts.all}
            />
            <SubmenuTooltipItem
              href='/orders?status=RECEIVED'
              label='Нові'
              count={orderCounts.RECEIVED}
            />
            <SubmenuTooltipItem
              href='/orders?status=PREPARED'
              label='Зібрані'
              count={orderCounts.PREPARED}
            />
            <SubmenuTooltipItem
              href='/orders?status=SHIPPED'
              label='Відправлені'
              count={orderCounts.SHIPPED}
            />
            <SubmenuTooltipItem
              href='/orders?status=DELIVERED'
              label='Доставлені'
              count={orderCounts.DELIVERED}
            />
            <SubmenuTooltipItem
              href='/orders?status=CANCELED'
              label='Скасовані'
              count={orderCounts.CANCELED}
            />
            <Link
              href='/orders/create'
              className='block px-3 py-1.5 hover:bg-gray-700 transition-colors'
            >
              Створити замовлення
            </Link>
          </div>

          {/* Arrow pointing to the icon */}
          <div className='absolute top-1/2 -left-1.5 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[6px] border-r-gray-800'></div>
        </div>
      )}
    </>
  )
}

// Small helper for tooltip submenu rows with optional badge
const SubmenuTooltipItem = ({
  href,
  label,
  count,
}: {
  href: string
  label: string
  count: number
}) => (
  <Link
    href={href}
    className='flex items-center justify-between px-3 py-1.5 hover:bg-gray-700 transition-colors'
  >
    <span>{label}</span>
    {count > 0 && (
      <span className='ml-2 bg-white text-[#45455c] text-[10px] font-bold px-1.5 py-0.5 rounded min-w-[20px] text-center'>
        {count}
      </span>
    )}
  </Link>
)

// Submenu item shown in the expanded sidebar
const SubmenuItem = ({
  href,
  label,
  count,
}: {
  href: string
  label: string
  count?: number
}) => (
  <Link
    href={href}
    className='flex items-center justify-between py-2 text-[14px] text-[#b8b8c8] hover:text-white transition-colors'
  >
    <span>{label}</span>
    {count !== undefined && count > 0 && (
      <span className='bg-white text-[#45455c] text-[11px] font-semibold px-2 py-0.5 rounded-md min-w-[24px] text-center'>
        {count}test
      </span>
    )}
  </Link>
)

const Sidebar = () => {
  const dispatch = useAppDispatch()
  const isSidebarCollapsed = useAppSelector(
    (state) => state.global.isSidebarCollapsed,
  )
  const [isOrdersOpen, setIsOrdersOpen] = useState(true)
const orderCounts = useOrderCounts()

  const toggleSidebar = () => {
    dispatch(setIsSidebarCollapsed(!isSidebarCollapsed))
  }

  const sidebarClassNames = `fixed flex flex-col ${
    isSidebarCollapsed ? 'w-0 md:w-20' : 'w-64'
  } bg-[#45455c] transition-all duration-300 h-full shadow-md z-40 border-r border-[#52526a]`

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
            width={36}
            height={36}
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
      <div className='flex-grow mt-8 space-y-1 overflow-y-auto'>
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
          hasSubmenu={!isSidebarCollapsed}
          isOpen={isOrdersOpen}
          onToggle={() => setIsOrdersOpen(!isOrdersOpen)}
        />

        {!isSidebarCollapsed && isOrdersOpen && (
          <div className='ml-12 space-y-1 mt-1 transition-all duration-300 pr-4'>
            <SubmenuItem
              href='/orders'
              label='Всі замовлення'
              count={orderCounts.all}
            />
            <SubmenuItem
              href='/orders?status=RECEIVED'
              label='Нові'
              count={orderCounts.RECEIVED}
            />
            <SubmenuItem
              href='/orders?status=PREPARED'
              label='Зібрані'
              count={orderCounts.PREPARED}
            />
            <SubmenuItem
              href='/orders?status=SHIPPED'
              label='Відправлені'
              count={orderCounts.SHIPPED}
            />
            <SubmenuItem
              href='/orders?status=DELIVERED'
              label='Доставлені'
              count={orderCounts.DELIVERED}
            />
            <SubmenuItem
              href='/orders?status=CANCELED'
              label='Скасовані'
              count={orderCounts.CANCELED}
            />
            <SubmenuItem href='/orders/create' label='Створити замовлення' />
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
      <div className='pb-6'>
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
    </div>
  )
}

export default Sidebar
