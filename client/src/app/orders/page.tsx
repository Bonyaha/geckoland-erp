// client/src/app/orders/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'

import {
  useGetOrdersQuery,
  useUpdateOrderMutation,
  useCheckForNewOrdersMutation,
  useFetchTrackingNumberMutation,
  useUpdateAllTrackingStatusesMutation,
  useSyncPaymentStatusesMutation,
  Order,
  OrderStatus,
  OrderSource,
} from '@/state/api'

import {
  Package,
  Search,
  Filter,
  RefreshCw,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
X
} from 'lucide-react'

import Toast from '@/app/(components)/Toast'
import { useToast } from '@/hooks/useToast'
import { getPaymentStatusLabel } from '@/utils/marketplaceUtils'

import CopyableItem from '@/app/(components)/CopyableItem'
import CustomSelect from '@/app/(components)/CustomSelect'

import EditOrderModal from './(components)/EditOrderModal'

const OrdersPage = () => {
  const searchParams = useSearchParams()
  const statusFromUrl = searchParams.get('status') as OrderStatus | null

  // State
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>(
    statusFromUrl || 'all',
  )

  const [sourceFilter, setSourceFilter] = useState<OrderSource | 'all'>('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null) // State for Actions menu

  const [editingOrder, setEditingOrder] = useState<Order | null>(null)

  const { toast, showToast, hideToast } = useToast()

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveActionMenu(null)
    if (activeActionMenu) {
      document.addEventListener('click', handleClickOutside)
    }
    return () => document.removeEventListener('click', handleClickOutside)
  }, [activeActionMenu])

  // Update status filter when URL changes
  useEffect(() => {
    if (statusFromUrl) {
      setStatusFilter(statusFromUrl)
    } else {
      // If no status in URL, show all orders
      setStatusFilter('all')
    }
    // Reset to first page when status changes
    setPage(1)
  }, [statusFromUrl])

  // Options for CustomSelect
  const statusOptions = [
    { value: 'all', label: 'Всі статуси' },
    { value: 'RECEIVED', label: 'Прийнято' },
    { value: 'PREPARED', label: 'Зібрано' },
    { value: 'SHIPPED', label: 'Відправлено' },
    { value: 'AWAITING_PICKUP', label: 'На відділенні' },
    { value: 'DELIVERED', label: 'Доставлено' },
    { value: 'CANCELED', label: 'Скасовано' },
    { value: 'RETURN', label: 'Повернення' },
  ]

  const sourceOptions = [
    { value: 'all', label: 'Всі джерела' },
    { value: 'prom', label: 'Prom' },
    { value: 'rozetka', label: 'Rozetka' },
    { value: 'crm', label: 'CRM' },
  ]

  // API hooks
  const {
    data: ordersData,
    isLoading,
    refetch,
  } = useGetOrdersQuery({
    page,
    limit: 20,
    status: statusFilter === 'all' ? undefined : statusFilter,
    source: sourceFilter === 'all' ? undefined : sourceFilter,
  })

  const [updateOrder] = useUpdateOrderMutation()

  const [fetchTrackingNumber, { isLoading: isFetchingTracking }] =
    useFetchTrackingNumberMutation()

  const [updateAllTrackingStatuses, { isLoading: isUpdatingStatuses }] =
    useUpdateAllTrackingStatusesMutation()

  const [checkNewOrders, { isLoading: isChecking }] =
    useCheckForNewOrdersMutation()

const [syncPaymentStatuses, { isLoading: isSyncingPayments }] =
  useSyncPaymentStatusesMutation()


  // Handlers
  const handleStatusChange = async (
    orderId: string,
    newStatus: OrderStatus,
  ) => {
    try {
      await updateOrder({
        orderId,
        updates: { status: newStatus },
      }).unwrap()
      refetch()
    } catch (error) {
      console.error('Failed to update order status:', error)
    }
  }

  const handleUpdateTrackingStatuses = async () => {
    try {
      const result = await updateAllTrackingStatuses().unwrap()
      if (result.success) {
        showToast(
          `Оновлено статуси: ${result.updated} з ${result.total} замовлень`,
          'success',
        )
        refetch()
      } else {
        showToast('Помилка оновлення статусів', 'error')
      }
    } catch (error: any) {
      console.error('Failed to update tracking statuses:', error)
      showToast(
        error?.data?.message || 'Помилка оновлення статусів відстеження',
        'error',
      )
    }
  }

  const handleCheckNewOrders = async () => {
    try {
      const result = await checkNewOrders().unwrap()
      showToast(
        `Знайдено нових замовлень: Prom: ${result.prom.created}, Rozetka: ${result.rozetka.created}`,
        'success',
      )
      refetch()
    } catch (error) {
      console.error('Failed to check new orders:', error)
      showToast('Помилка перевірки нових замовлень', 'error')
    }
  }

const handleSyncPaymentStatuses = async () => {
  try {
    const result = await syncPaymentStatuses().unwrap()
    const { checked, updated, errors } = result.data
    showToast(
      `Оплати перевірено: ${checked}, оновлено: ${updated}${errors > 0 ? `, помилок: ${errors}` : ''}`,
      updated > 0 ? 'success' : 'info',
    )
    if (updated > 0) refetch()
  } catch (error: any) {
    showToast(
      error?.data?.message || 'Помилка синхронізації статусів оплати',
      'error',
    )
  }
}

  // Utility functions
  const getStatusConfig = (status: OrderStatus) => {
    const configs = {
      RECEIVED: {
        label: 'Прийнято',
        color: 'bg-blue-100 text-blue-800',
        icon: Clock,
      },
      PREPARED: {
        label: 'Зібрано',
        color: 'bg-yellow-100 text-yellow-800',
        icon: Package,
      },
      SHIPPED: {
        label: 'Відправлено',
        color: 'bg-purple-100 text-purple-800',
        icon: Truck,
      },
      AWAITING_PICKUP: {
        label: 'На відділенні',
        color: 'bg-orange-100 text-orange-600',
        icon: Clock,
      },
      DELIVERED: {
        label: 'Доставлено',
        color: 'bg-green-100 text-green-800',
        icon: CheckCircle,
      },
      CANCELED: {
        label: 'Скасовано',
        color: 'bg-red-100 text-red-800',
        icon: XCircle,
      },
      RETURN: {
        label: 'Повернення',
        color: 'bg-gray-100 text-gray-800',
        icon: XCircle,
      },
    }
    return configs[status] || configs.RECEIVED
  }

  /* const getStatusBadge = (status: OrderStatus) => {
    const config = getStatusConfig(status)
    const Icon = config.icon
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${config.color}`}
      >
        <Icon size={14} />
        {config.label}
      </span>
    )
  } */

  const getSourceBadge = (source: OrderSource) => {
    const sourceConfig = {
      prom: { label: 'Prom', color: 'bg-indigo-100 text-indigo-800' },
      rozetka: { label: 'Rozetka', color: 'bg-green-100 text-green-800' },
      crm: { label: 'CRM', color: 'bg-gray-100 text-gray-800' },
    }
    const config = sourceConfig[source]
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
    }).format(amount)
  }

  const handleFetchTracking = async (orderId: string) => {
    try {
      const result = await fetchTrackingNumber(orderId).unwrap()
      if (result.success) {
        showToast(result.message || 'ТТН успішно отримано', 'success')
        // Update the selected order with the new tracking number
        if (selectedOrder && selectedOrder.orderId === orderId) {
          setSelectedOrder({
            ...selectedOrder,
            trackingNumber: result.data.trackingNumber,
          })
        }
        // The invalidation in api.ts will refresh the orders list
        refetch()
      } else {
        // Handles the 'not yet available' case
        showToast(
          result.message || 'ТТН ще не доступний у маркетплейсі',
          'info',
        )
      }
    } catch (error: any) {
      console.error('Failed to fetch tracking:', error)
      showToast(error?.data?.message || 'Помилка при отриманні ТТН', 'error')
    }
  }

  // Extract orders from the response
  const orders = ordersData?.data?.orders || []
  const pagination = ordersData?.data?.pagination

  // Filter orders by search term
  const filteredOrders = orders.filter((order) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      order.orderNumber?.toLowerCase().includes(searchLower) ||
      order.clientPhone.includes(searchTerm) ||
      order.clientFullName?.toLowerCase().includes(searchLower)
    )
  })

  const handleCopy = (value: string) =>
    showToast(`Номер ${value} скопійовано`, 'success')

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-screen'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600' />
      </div>
    )
  }

  //console.log('orders are: ', filteredOrders);

  return (
    <div className='p-6 bg-gray-50 min-h-screen text-base'>
      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
      {/* Header */}
      <div className='mb-6'>
        <h1 className='text-3xl font-bold text-gray-900 mb-2'>Замовлення</h1>
        <p className='text-lg text-gray-600'>
          Всього: {pagination?.total || 0} замовлень
        </p>
      </div>
      {/* Filters and Actions */}
      <div className='bg-white rounded-lg shadow-sm p-4 mb-6'>
        <div className='flex flex-wrap gap-4 items-center'>
          {/* Search */}
          <div className='flex-1 min-w-[250px]'>
            <div className='relative flex items-center'>
              <Search
                className='absolute left-3 text-gray-400 pointer-events-none'
                size={20}
              />
              <input
                type='text'
                placeholder='Пошук по номеру, телефону, імені...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base transition-all'
              />

              {/* Clear Button (X Icon) */}
              {searchTerm && (
                <button
                  type='button'
                  onClick={() => {
                    setSearchTerm('')
                    setPage(1)
                  }}
                  /* hover:bg-gray-100 and rounded-full create the circular background effect */
                  className='absolute right-2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all flex items-center justify-center cursor-pointer'
                  aria-label='Очистити пошук'
                >
                  <X size={20} />             
                </button>
              )}
            </div>
          </div>

          {/* Status Filter */}
          <div className='flex items-center gap-2'>
            <Filter size={20} className='text-gray-400' />
            <CustomSelect
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val)
                setPage(1)
              }}
              options={statusOptions}
              className='w-48'
            />
          </div>

          {/* Source Filter */}
          <CustomSelect
            value={sourceFilter}
            onChange={(val) => {
              setSourceFilter(val)
              setPage(1)
            }}
            options={sourceOptions}
            className='w-44 shrink-0'
          />

          {/* Actions */}
          <button
            onClick={handleCheckNewOrders}
            disabled={isChecking}
            className='flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-base font-semibold cursor-pointer'
          >
            <RefreshCw size={18} className={isChecking ? 'animate-spin' : ''} />
            Перевірити нові
          </button>
          <button
            onClick={handleUpdateTrackingStatuses}
            disabled={isUpdatingStatuses}
            className='flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-base font-semibold cursor-pointer'
          >
            <Truck
              size={18}
              className={isUpdatingStatuses ? 'animate-spin' : ''}
            />
            Оновити статуси
          </button>
        </div>
      </div>
      {/* Orders Table */}
      <div className='bg-white rounded-lg shadow-sm overflow-hidden'>
        <div className='overflow-x-auto'>
          <table className='w-full'>
            <thead className='bg-gray-50 border-b border-gray-200'>
              <tr>
                <th className='px-6 py-4 text-left text-sm font-bold text-gray-500 uppercase'>
                  Дата
                </th>
                <th className='px-6 py-4 text-left text-sm font-bold text-gray-500 uppercase'>
                  № Зам-ня
                </th>
                <th className='px-6 py-4 text-left text-sm font-bold text-gray-500 uppercase'>
                  Клієнт
                </th>
                <th className='px-6 py-4 text-left text-sm font-bold text-gray-500 uppercase'>
                  Сума
                </th>
                <th className='px-6 py-4 text-left text-sm font-bold text-gray-500 uppercase'>
                  <div className='flex items-center gap-2'>
                    <span>Оплата</span>
                    <div className='relative group flex items-center'>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSyncPaymentStatuses()
                        }}
                        disabled={isSyncingPayments}
                        className='p-1.5 hover:bg-gray-200 rounded-full transition-colors cursor-pointer disabled:opacity-50'
                      >
                        <RefreshCw
                          size={14}
                          className={`${isSyncingPayments ? 'animate-spin text-violet-600' : 'text-gray-400 group-hover:text-violet-600'}`}
                        />
                      </button>
                      <div className='invisible group-hover:visible absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900 text-white text-[11px] font-medium rounded-lg whitespace-nowrap shadow-xl z-[100] normal-case tracking-normal'>
                        Перевірити неоплачені статуси
                        {/* Tooltip Arrow pointing UP */}
                        <div className='absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900' />
                      </div>
                    </div>
                  </div>
                </th>
                <th className='px-6 py-4 text-left text-sm font-bold text-gray-500 uppercase'>
                  Статус замовлення
                </th>
                <th className='px-6 py-4 text-right text-sm font-bold text-gray-500 uppercase'>
                  Дії
                </th>
              </tr>
            </thead>

            <tbody className='bg-white divide-y divide-gray-200'>
              {filteredOrders?.map((order) => (
                <tr
                  key={order.orderId}
                  className={`hover:bg-gray-50 cursor-pointer`}
                  onClick={() => setSelectedOrder(order)}
                >
                  <td className='px-6 py-5 whitespace-nowrap text-base text-gray-500'>
                    {formatDate(order.createdAt)}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <div className='flex items-center gap-2'>
                      <div className='flex flex-col'>
                        <CopyableItem
                          value={
                            order.orderNumber || order.externalOrderId || ''
                          }
                          displayValue={`#${order.orderNumber || order.externalOrderId}`}
                          className='text-base font-bold text-gray-900'
                          align='left'
                          onCopy={handleCopy}
                        />
                        <div className='text-xs text-gray-500 mt-1'>
                          {getSourceBadge(order.source)}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className='px-6 py-5 whitespace-nowrap'>
                    {/* Requirement 2: Smaller font and removed boldness */}
                    <div className='text-base font-normal text-gray-900'>
                      {order.clientFullName}
                    </div>
                    <CopyableItem
                      value={order.clientPhone}
                      className='text-sm font-medium text-gray-600 mt-1'
                      onCopy={handleCopy}
                    />
                  </td>

                  <td className='px-6 py-5 whitespace-nowrap text-base font-bold text-gray-900'>
                    {formatCurrency(
                      order.totalAmountWithDiscount || order.totalAmount,
                    )}
                  </td>

                  <td className='px-6 py-5 whitespace-nowrap text-base'>
                    <span
                      className={`font-medium ${order.paymentStatus === 'PAID' ? 'text-green-600' : order.paymentStatus === 'UNPAID' ? 'text-red-600' : 'text-gray-700'}`}
                    >
                      {getPaymentStatusLabel(order.paymentStatus)}
                    </span>
                    <div className='text-gray-500 text-sm'>
                      ({order.paymentOptionName})
                    </div>
                  </td>

                  <td className='px-6 py-5 whitespace-nowrap'>
                    {(() => {
                      const config = getStatusConfig(order.status)
                      const StatusIcon = config.icon

                      return (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full transition-all cursor-pointer ${config.color}`}
                        >
                          <StatusIcon size={14} className='shrink-0' />

                          <CustomSelect
                            value={order.status}
                            onChange={(newStatus) =>
                              handleStatusChange(
                                order.orderId,
                                newStatus as OrderStatus,
                              )
                            }
                            options={statusOptions.filter(
                              (opt) => opt.value !== 'all',
                            )}
                            isMinimal={true}
                            // Added 'rounded-full' here to ensure the component wrapper is rounded
                            className='text-xs rounded-full'
                          />
                        </div>
                      )
                    })()}
                  </td>

                  {/* Requirement 3: Actions column */}
                  <td className='px-6 py-5 whitespace-nowrap text-right'>
                    <div
                      className='relative inline-block text-left'
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() =>
                          setActiveActionMenu(
                            activeActionMenu === order.orderId
                              ? null
                              : order.orderId,
                          )
                        }
                        className='p-2 hover:bg-gray-100 rounded-full transition-colors'
                      >
                        <MoreVertical
                          size={20}
                          className='text-gray-500 cursor-pointer'
                        />
                      </button>

                      {activeActionMenu === order.orderId && (
                        <div className='absolute right-0 mt-2 w-48 rounded-md shadow-xl bg-white ring-1 ring-black ring-opacity-5 z-[100] divide-y divide-gray-100'>
                          <div className='py-1'>
                            <button
                              className='flex items-center w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 transition-colors cursor-pointer'
                              onClick={() => setEditingOrder(order)}
                            >
                              Редагувати
                            </button>
                            <button className='flex items-center w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 transition-colors cursor-pointer'>
                              Копіювати продаж
                            </button>
                            <button className='flex items-center w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 transition-colors cursor-pointer'>
                              Додати витрату
                            </button>
                          </div>
                          <div className='py-1'>
                            <button className='flex items-center w-full px-4 py-2.5 text-sm text-red-600 font-medium hover:bg-red-50 transition-colors cursor-pointer'>
                              Видалити
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className='flex items-center justify-between px-6 py-4 border-t border-gray-200'>
            <div className='text-sm text-gray-700'>
              Сторінка {pagination.page} з {pagination.pages}
            </div>
            <div className='flex gap-2'>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className='p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50'
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() =>
                  setPage((p) => Math.min(pagination.pages, p + 1))
                }
                disabled={page === pagination.pages}
                className='p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50'
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Order Details Modal (Selected Order) */}
      {selectedOrder && (
        <div
          className='fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4'
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className='bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='p-8'>
              <div className='flex justify-between items-start mb-8'>
                <div>
                  <div className='flex items-center gap-3'>
                    <h2 className='text-2xl font-bold text-gray-900'>
                      Замовлення
                    </h2>

                    <CopyableItem
                      value={selectedOrder.orderNumber || ''}
                      displayValue={`#${selectedOrder.orderNumber}`}
                      className='text-2xl font-bold text-green-600'
                      align='left'
                      onCopy={handleCopy}
                    />
                  </div>

                  <p className='text-sm text-gray-500 mt-1'>
                    {formatDate(selectedOrder.createdAt)}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedOrder(null)}
                  className='text-2xl text-gray-400 hover:text-gray-600 cursor-pointer'
                >
                  ✕
                </button>
              </div>

              <div className='grid grid-cols-2 gap-8 mb-8'>
                <div>
                  <h3 className='text-sm font-medium text-gray-500 mb-2'>
                    Клієнт
                  </h3>
                  <p className='text-gray-900 font-semibold mb-1'>
                    {selectedOrder.clientFullName}
                  </p>
                  <CopyableItem
                    value={selectedOrder.clientPhone}
                    className='text-lg font-bold text-gray-900'
                    align='left'
                    onCopy={handleCopy}
                  />
                </div>

                <div>
                  <h3 className='text-sm font-bold text-gray-400 uppercase mb-2'>
                    Доставка
                  </h3>
                  <p className='text-lg font-bold text-gray-900'>
                    {selectedOrder.deliveryOptionName || 'Не вказано'}
                  </p>
                  <p className='text-base text-gray-600'>
                    {selectedOrder.deliveryCity}
                  </p>
                  {selectedOrder.trackingNumber ? (
                    <CopyableItem
                      value={selectedOrder.trackingNumber}
                      displayValue={`ТТН: ${selectedOrder.trackingNumber}`}
                      className='text-lg font-bold text-gray-900'
                      onCopy={handleCopy}
                    />
                  ) : (
                    /* Button appears only if tracking is missing and source is Prom/Rozetka */
                    (selectedOrder.source === 'prom' ||
                      selectedOrder.source === 'rozetka') && (
                      <button
                        onClick={() =>
                          handleFetchTracking(selectedOrder.orderId)
                        }
                        disabled={isFetchingTracking}
                        className='mt-2 flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 disabled:opacity-50 text-sm font-semibold transition-colors cursor-pointer'
                      >
                        <RefreshCw
                          size={14}
                          className={isFetchingTracking ? 'animate-spin' : ''}
                        />
                        Синхронізувати ТТН
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className='mb-8'>
                <h3 className='text-sm font-bold text-gray-400 uppercase mb-4'>
                  Товари
                </h3>

                <div className='space-y-3'>
                  {selectedOrder.orderItems.map((item) => (
                    <div
                      key={item.orderItemId}
                      className='flex justify-between items-center p-4 bg-gray-50 rounded-xl'
                    >
                      <div className='flex items-center gap-4'>
                        {item.productImage && (
                          <Image
                            src={item.productImage}
                            alt={item.productName}
                            width={60}
                            height={60}
                            className='object-cover rounded-lg'
                          />
                        )}

                        <div>
                          <p className='text-lg font-bold text-gray-900'>
                            {item.productName}
                          </p>

                          <p className='text-base text-gray-600'>
                            {item.quantity} × {formatCurrency(item.unitPrice)}
                          </p>
                        </div>
                      </div>

                      <p className='text-lg font-bold text-gray-900'>
                        {formatCurrency(item.totalPrice)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className='border-t pt-6'>
                <div className='flex justify-between items-center text-2xl font-black'>
                  <span>Загалом:</span>
                  <span className='text-blue-600'>
                    {formatCurrency(
                      selectedOrder.totalAmountWithDiscount ||
                        selectedOrder.totalAmount,
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Edit Order Modal */}
      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onSuccess={() => setEditingOrder(null)}
        />
      )}
    </div>
  )
}

export default OrdersPage
