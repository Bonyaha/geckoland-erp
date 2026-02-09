'use client'

import { useState } from 'react'
import { useGetClientsQuery } from '@/state/api'
import { Search, Star, UserPlus, Mail, Phone, MapPin } from 'lucide-react'
import CopyableItem from '@/app/(components)/CopyableItem'
import { useToast } from '@/hooks/useToast'
import Toast from '@/app/(components)/Toast'

const Clients = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  const { toast, showToast, hideToast } = useToast()

  const { data, isLoading, isError } = useGetClientsQuery({
    search: searchTerm,
    page: currentPage,
    limit: itemsPerPage,
  })

  const handleCopy = (value: string) => {
    showToast(`${value} скопійовано`, 'success')
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-screen'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600' />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className='text-center text-red-500 py-4'>
        Помилка завантаження клієнтів
      </div>
    )
  }

  const clients = data.data?.clients || []
  const pagination = data.data?.pagination

  const getReliabilityColor = (reliability: string | null) => {
    if (!reliability) return 'text-gray-400'
    const value = parseInt(reliability)
    if (value >= 90) return 'text-yellow-500'
    if (value >= 70) return 'text-green-500'
    return 'text-gray-400'
  }

  const renderStars = (reliability: string | null) => {
    if (!reliability) {
      return (
        <div className='flex items-center gap-1 text-gray-300'>
          <Star className='w-4 h-4' />
          <span className='text-sm'>Без рейтингу</span>
        </div>
      )
    }

    const value = parseInt(reliability)
    const fillColor = getReliabilityColor(reliability)

    return (
      <div className='flex items-center gap-1'>
        <Star className={`w-4 h-4 ${fillColor}`} fill='currentColor' />
        <span className={`text-sm font-bold ${fillColor}`}>{value}%</span>
      </div>
    )
  }

  return (
    <div className='p-6 bg-gray-50 min-h-screen'>
      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />

      {/* Header */}
      <div className='mb-6'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-3xl font-bold text-gray-900 mb-2'>
              Список покупців
            </h1>
            <p className='text-lg text-gray-600'>
              Всі: {pagination?.total || 0}
            </p>
          </div>
          <div className='flex items-center gap-4'>
            <button className='flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer'>
              Експорт
            </button>
            <button className='flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer'>
              Створити замовлення
            </button>
            <button className='flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors cursor-pointer'>
              <UserPlus className='w-5 h-5' />
              Додати покупця
            </button>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className='bg-white rounded-lg shadow-sm p-4 mb-6'>
        <div className='flex items-center gap-4'>
          <div className='relative flex-1'>
            <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5' />
            <input
              type='text'
              placeholder='Пошук по ПІБ, покупця, номеру телефону, Email'
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none'
            />
          </div>
          <button className='px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer'>
            Відфільтрувати покупців
          </button>
        </div>
      </div>

      {/* Clients Table */}
      <div className='bg-white rounded-lg shadow-sm overflow-hidden'>
        <table className='min-w-full'>
          <thead className='bg-gray-50 border-b border-gray-200'>
            <tr>
              <th className='px-6 py-3 text-left'>
                <input
                  type='checkbox'
                  className='rounded border-gray-300 cursor-pointer'
                />
              </th>
              <th className='px-6 py-3 text-left text-sm font-bold text-gray-500 uppercase'>
                Покупець
              </th>
              <th className='px-6 py-3 text-left text-sm font-bold text-gray-500 uppercase'>
                Надійність
              </th>
              <th className='px-6 py-3 text-left text-sm font-bold text-gray-500 uppercase'>
                Замовлень
              </th>
              <th className='px-6 py-3 text-left text-sm font-bold text-gray-500 uppercase'>
                Обіг
              </th>
              <th className='px-6 py-3 text-left text-sm font-bold text-gray-500 uppercase'>
                Останнє замовлення
              </th>
              <th className='px-6 py-3 text-left text-sm font-bold text-gray-500 uppercase'>
                Мітки
              </th>
            </tr>
          </thead>
          <tbody className='divide-y divide-gray-200'>
            {clients.map((client: any) => (
              <tr
                key={client.clientId}
                className='hover:bg-gray-50 transition-colors'
              >
                <td className='px-6 py-4'>
                  <input
                    type='checkbox'
                    className='rounded border-gray-300 cursor-pointer'
                  />
                </td>
                <td className='px-6 py-4'>
                  <div className='flex flex-col gap-1'>
                    <div className='text-base font-bold text-blue-600 hover:underline cursor-pointer'>
                      {client.lastName} {client.firstName}{' '}
                      {client.secondName || ''}
                    </div>
                    <div className='flex items-center gap-2 text-sm text-gray-600'>
                      <Phone className='w-4 h-4' />
                      <CopyableItem
                        value={client.phone}
                        className='font-medium'
                        align='left'
                        onCopy={handleCopy}
                      />
                    </div>
                    {client.email && (
                      <div className='flex items-center gap-2 text-sm text-gray-500'>
                        <Mail className='w-4 h-4' />
                        <span>{client.email}</span>
                      </div>
                    )}
                    {client.address && (
                      <div className='flex items-center gap-2 text-sm text-gray-500'>
                        <MapPin className='w-4 h-4' />
                        <span className='truncate max-w-xs'>
                          {client.address}
                        </span>
                      </div>
                    )}
                  </div>
                </td>
                <td className='px-6 py-4'>{renderStars(client.reliability)}</td>
                <td className='px-6 py-4'>
                  <span className='text-base font-bold text-gray-900'>
                    {client.totalOrders}
                  </span>
                </td>
                <td className='px-6 py-4'>
                  <span className='text-base font-bold text-gray-900'>
                    {parseFloat(client.totalSpent).toLocaleString('uk-UA', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    ₴
                  </span>
                </td>
                <td className='px-6 py-4'>
                  <span className='text-sm text-gray-600'>
                    {client.updatedAt
                      ? new Date(client.updatedAt).toLocaleDateString('uk-UA', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </span>
                </td>
                <td className='px-6 py-4'>
                  <button className='text-gray-400 hover:text-gray-600 cursor-pointer'>
                    +
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {clients.length === 0 && (
          <div className='text-center py-10 text-gray-500'>
            Клієнтів не знайдено
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className='flex items-center justify-center gap-2 p-4 border-t border-gray-200'>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className='px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
            >
              Попередня
            </button>
            <span className='text-sm text-gray-600'>
              Сторінка {currentPage} з {pagination.pages}
            </span>
            <button
              onClick={() =>
                setCurrentPage((p) => Math.min(pagination.pages, p + 1))
              }
              disabled={currentPage === pagination.pages}
              className='px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
            >
              Наступна
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Clients
