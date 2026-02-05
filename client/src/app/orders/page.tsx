// client/src/app/orders/page.tsx
'use client'

import { useState, useEffect /* useRef */ } from 'react'
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
  /* X */
} from 'lucide-react'
import Toast from '@/app/(components)/Toast'
import { useToast } from '@/hooks/useToast'
import CopyableItem from '@/app/(components)/CopyableItem'

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

  const { toast, showToast, hideToast } = useToast()

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
      showToast(
        `Знайдено нових замовлень: Prom: ${result.prom.created}, Rozetka: ${result.rozetka.created}, Всього: ${result.totals.created}`,
        'success',
      )
      refetch()
    } catch (error) {
      console.error('Failed to check new orders:', error)
      showToast('Помилка перевірки нових замовлень', 'error')
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

  const handleCopy = (value: string) => {
    showToast(`Номер ${value} скопійовано`, 'success')

    if (isLoading) {
      return (
        <div className='flex items-center justify-center h-screen'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600' />
        </div>
      )
    }
  }

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
            className='flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-base font-semibold cursor-pointer'
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
                  className={`hover:bg-gray-50 cursor-pointer`}                  
                  onClick={() => setSelectedOrder(order)}
                >
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
                    <div className='text-lg font-bold text-gray-900'>
                      {order.clientFullName}
                    </div>
                    <CopyableItem
                      value={order.clientPhone}
                      className='text-base font-medium text-gray-600 mt-1'
                      onCopy={handleCopy}
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
                    align='left'
                    onCopy={handleCopy}
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
                    <CopyableItem
                      value={selectedOrder.trackingNumber}
                      displayValue={`ТТН: ${selectedOrder.trackingNumber}`}
                      className='text-lg font-bold text-gray-900'
                      onCopy={handleCopy}
                    />
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
