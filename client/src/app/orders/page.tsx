// client/src/app/orders/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import {
  useGetOrdersQuery,
  useUpdateOrderMutation,
  useCheckForNewOrdersMutation,
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
  X,
} from 'lucide-react'

const Toast = ({
  message,
  isVisible,
  onClose,
}: {
  message: string
  isVisible: boolean
  onClose: () => void
}) => {
  if (!isVisible) return null

  return (
    <div className='fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] flex items-center gap-3 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-2xl animate-in fade-in zoom-in duration-300'>
      <CheckCircle className='text-green-400' size={20} />
      <span className='text-sm font-semibold'>{message}</span>
      <button
        onClick={onClose}
        className='ml-2 text-gray-400 hover:text-white transition-colors'
      >
        <X size={18} />
      </button>
    </div>
  )
}



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

  const [toast, setToast] = useState({ message: '', isVisible: false })
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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

  // Auto-close toast
  useEffect(() => {
    if (toast.isVisible) {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current)
      }
      toastTimeoutRef.current = setTimeout(() => {
        setToast((prev) => ({ ...prev, isVisible: false }))
      }, 3000) // Close after 3 seconds
    }
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current)
      }
    }
  }, [toast.isVisible])

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
  const [checkNewOrders, { isLoading: isChecking }] =
    useCheckForNewOrdersMutation()

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

  const handleCheckNewOrders = async () => {
    try {
      const result = await checkNewOrders().unwrap()
      alert(
        `Знайдено нових замовлень:\nProm: ${result.prom.created}\nRozetka: ${result.rozetka.created}\nВсього: ${result.totals.created}`,
      )
      refetch()
    } catch (error) {
      console.error('Failed to check new orders:', error)
    }
  }

  // Utility functions
  const getStatusBadge = (status: OrderStatus) => {
    const statusConfig = {
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
        color: 'bg-orange-100 text-orange-800',
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

    const config = statusConfig[status] || statusConfig.RECEIVED
    const Icon = config.icon

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
      >
        <Icon size={12} />
        {config.label}
      </span>
    )
  }

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

  const handleCopy = (e: React.MouseEvent, text: string) => {
    e.stopPropagation() // Prevents the Modal from opening
    navigator.clipboard.writeText(text)
    setToast({
      message: `Номер ${text} скопійовано`,
      isVisible: true,
    })
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-screen'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600' />
      </div>
    )
  }

  // Unified Helper: Base text + Card Popover on hover
  // Unified Helper: Base text + Card Popover on hover (Bottom Direction)
  const CopyableItem = ({
    value,
    displayValue,
    className = '',
  }: {
    value: string
    displayValue?: string
    className?: string
  }) => (
    <div className='relative group inline-block'>
      {/* The visible text/trigger */}
      <div
        onClick={(e) => handleCopy(e, value)}
        className={`cursor-pointer transition-colors group-hover:text-green-600 ${className}`}
      >
        {displayValue || value}
      </div>

      {/* The Card-style popover (Now appearing on the BOTTOM) */}
      <div className='absolute left-0 top-full mt-2 opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50 -translate-y-2 group-hover:translate-y-0'>
        <div className='bg-white border border-gray-300 rounded-xl px-4 py-2 shadow-xl flex flex-col whitespace-nowrap border-t-4 border-t-green-500'>
          <span className='text-green-600 font-bold text-lg leading-tight'>
            {value}
          </span>
          <span className='text-gray-400 text-[10px] mt-0.5'>
            Натисніть, щоб скопіювати
          </span>

          {/* Small arrow/tail (Flipped to point UP) */}
          <div className='absolute -top-2 left-4 w-3 h-3 bg-white border-l border-t border-gray-300 rotate-45'></div>
        </div>
      </div>
    </div>
  )

  return (
    <div className='p-6 bg-gray-50 min-h-screen text-base'>
      {/* Toast Notification */}
      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={() => setToast((prev) => ({ ...prev, isVisible: false }))}
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
            <div className='relative'>
              <Search
                className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400'
                size={22}
              />
              <input
                type='text'
                placeholder='Пошук по номеру, телефону, імені...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-base'
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className='flex items-center gap-2'>
            <Filter size={20} className='text-gray-400' />
            <select
              value={statusFilter}
              onChange={(e) => {
                const newStatus = e.target.value as OrderStatus | 'all'
                setStatusFilter(newStatus)
                setPage(1)
              }}
              className='px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-base'
            >
              <option value='all'>Всі статуси</option>
              <option value='RECEIVED'>Прийнято</option>
              <option value='PREPARED'>Зібрано</option>
              <option value='SHIPPED'>Відправлено</option>
              <option value='AWAITING_PICKUP'>На відділенні</option>
              <option value='DELIVERED'>Доставлено</option>
              <option value='CANCELED'>Скасовано</option>
              <option value='RETURN'>Повернення</option>
            </select>
          </div>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) =>
              setSourceFilter(e.target.value as OrderSource | 'all')
            }
            className='px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'
          >
            <option value='all'>Всі джерела</option>
            <option value='prom'>Prom</option>
            <option value='rozetka'>Rozetka</option>
            <option value='crm'>CRM</option>
          </select>

          {/* Actions */}
          <button
            onClick={handleCheckNewOrders}
            disabled={isChecking}
            className='flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-base font-semibold'
          >
            <RefreshCw size={18} className={isChecking ? 'animate-spin' : ''} />
            Перевірити нові
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
                  Замовлення
                </th>
                <th className='px-6 py-4 text-left text-sm font-bold text-gray-500 uppercase'>
                  Клієнт
                </th>
                <th className='px-6 py-4 text-left text-sm font-bold text-gray-500 uppercase'>
                  Товари
                </th>
                <th className='px-6 py-4 text-left text-sm font-bold text-gray-500 uppercase'>
                  Сума
                </th>
                <th className='px-6 py-4 text-left text-sm font-bold text-gray-500 uppercase'>
                  Статус
                </th>
                <th className='px-6 py-4 text-left text-sm font-bold text-gray-500 uppercase'>
                  Дата
                </th>
                <th className='px-6 py-4 text-left text-sm font-bold text-gray-500 uppercase'>
                  Дії
                </th>
              </tr>
            </thead>
            <tbody className='bg-white divide-y divide-gray-200'>
              {filteredOrders?.map((order) => (
                <tr
                  key={order.orderId}
                  className={`hover:bg-gray-50 cursor-pointer ${!order.isViewed ? 'bg-blue-50' : ''}`}
                  onClick={() => setSelectedOrder(order)}
                >
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <div className='flex items-center gap-2'>
                      {!order.isViewed && (
                        <div className='w-2 h-2 bg-blue-600 rounded-full shrink-0' />
                      )}
                      <div className='flex flex-col'>
                        <CopyableItem
                          value={
                            order.orderNumber || order.externalOrderId || ''
                          }
                          displayValue={`#${order.orderNumber || order.externalOrderId}`}
                          className='text-base font-bold text-gray-900'
                        />
                        <div className='text-xs text-gray-500 mt-1'>
                          {getSourceBadge(order.source)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className='px-6 py-5 whitespace-nowrap'>
                    <div className='text-lg font-bold text-gray-900'>
                      {order.clientFullName}
                    </div>
                    <CopyableItem
                      value={order.clientPhone}
                      className='text-base font-medium text-gray-600 mt-1'
                    />
                  </td>

                  <td className='px-6 py-5 whitespace-nowrap text-base'>
                    {order.itemCount} шт
                  </td>
                  <td className='px-6 py-5 whitespace-nowrap text-base font-bold text-gray-900'>
                    {formatCurrency(order.totalAmount)}
                  </td>
                  <td className='px-6 py-5 whitespace-nowrap'>
                    {getStatusBadge(order.status)}
                  </td>
                  <td className='px-6 py-5 whitespace-nowrap text-base text-gray-500'>
                    {formatDate(order.createdAt)}
                  </td>
                  <td className='px-6 py-5 whitespace-nowrap'>
                    <select
                      value={order.status}
                      onChange={(e) => {
                        e.stopPropagation()
                        handleStatusChange(
                          order.orderId,
                          e.target.value as OrderStatus,
                        )
                      }}
                      className='text-sm border border-gray-300 rounded px-3 py-2'
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value='RECEIVED'>Прийнято</option>
                      <option value='PREPARED'>Зібрано</option>
                      <option value='SHIPPED'>Відправлено</option>
                      <option value='AWAITING_PICKUP'>На відділенні</option>
                      <option value='DELIVERED'>Доставлено</option>
                      <option value='CANCELED'>Скасовано</option>
                      <option value='RETURN'>Повернення</option>
                    </select>
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

      {/* Order Details Modal */}
      {selectedOrder && (
        <div
          className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'
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
                    />
                  </div>
                  <p className='text-sm text-gray-500 mt-1'>
                    {formatDate(selectedOrder.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className='text-2xl text-gray-400 hover:text-gray-600'
                >
                  ✕
                </button>
              </div>

              <div className='grid grid-cols-2 gap-8 mb-8'>
                {/* Replace the old Client Info block with this */}
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
                  />
                  {selectedOrder.clientEmail && (
                    <p className='text-sm text-gray-600 mt-2'>
                      {selectedOrder.clientEmail}
                    </p>
                  )}
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
                  {selectedOrder.trackingNumber && (
                    <p className='text-base font-bold text-blue-600 mt-1'>
                      ТТН: {selectedOrder.trackingNumber}
                    </p>
                  )}
                </div>
              </div>

              {/* Товари в модалці */}
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
                    {formatCurrency(selectedOrder.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrdersPage
