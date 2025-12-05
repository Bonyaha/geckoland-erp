'use client'

import { useCreateProductMutation, useGetProductsQuery } from '@/state/api'
import {
  PlusCircleIcon,
  SearchIcon,
  Download,
  Settings,
  RefreshCw,
  /* Pencil,
  Copy,
  Trash2 */
} from 'lucide-react'
//import Image from 'next/image'
import { useState } from 'react'
//import Header from '@/app/(components)/Header'
import CreateProductModal from './CreateProductModal'
import ProductStats from './ProductStats'
import ProductRow from './ProductRow'

// IMPORTANT: Updated the ProductFormData type to reflect what comes from the API
// (which likely requires less mandatory fields than the creation form)
// and match the structure needed for the table display.
type ProductType = {
  productId: string
  name: string
  price: number
  stockQuantity: number
  sku: string
  source?: string
  externalIds?: string
  description?: string
  mainImage?: string
  images?: string[]
  inStock?: number
  available?: boolean
  priceOld?: number
  pricePromo?: number
  updatedPrice?: number
  currency?: string
  dateModified?: string
  [key: string]: string | number | boolean | string[] | undefined
}

const Products = () => {
  // State management
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [stockFilter, setStockFilter] = useState<
    'all' | 'inStock' | 'outOfStock'
  >('all')
  const itemsPerPage = 20

  // Fetch products with filters
  const { data, isLoading, isError, refetch } = useGetProductsQuery({
    search: searchTerm,
    page: currentPage,
    limit: itemsPerPage,
    stockFilter,
  })

  const [createProduct] = useCreateProductMutation()

  const handleCreateProduct = async (productData: ProductType) => {
    await createProduct(productData)
  }

  // Action handlers
  const handleEdit = (id: string) => console.log('Edit product:', id)
  const handleCopy = (id: string) => console.log('Copy product:', id)
  const handleDelete = (id: string) => console.log('Delete product:', id)

  // Handle refresh
  const handleRefresh = () => {
    refetch()
  }

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  // Handle filter change
  const handleFilterChange = (filter: 'all' | 'inStock' | 'outOfStock') => {
    setStockFilter(filter)
    setCurrentPage(1) // Reset to first page when filter changes
  }

  if (isLoading) {
    return <div className='py-4'>Завантаження...</div>
  }

  if (isError || !data) {
    return (
      <div className='text-center text-red-500 py-4'>
        Помилка завантаження товарів
      </div>
    )
  }

  const { products, pagination } = data
  const typedProducts = products as ProductType[]

  // Generate page numbers for pagination
  const generatePageNumbers = () => {
    const pages = []
    const maxVisible = 5 // Maximum visible page numbers

    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    const endPage = Math.min(pagination.pages, startPage + maxVisible - 1)

    // Adjust start if we're near the end
    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1)
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }

    return pages
  }

  return (
    <div className='mx-auto pb-5 w-full'>
      {/* TOP SEARCH BAR */}
      <div className='mb-6'>
        <div className='flex items-center border-2 border-gray-200 rounded bg-white shadow-sm'>
          <RefreshCw
            className='w-5 h-5 text-gray-400 m-2 cursor-pointer hover:text-gray-600 transition-colors'
            onClick={handleRefresh}
          />
          <div className='h-6 w-px bg-gray-300 mx-1'></div>
          <SearchIcon className='w-5 h-5 text-gray-400 m-2' />
          <input
            className='w-full py-2 px-2 rounded bg-white outline-none text-gray-700'
            placeholder='Пошукова фраза...'
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1) // Reset to first page on search
            }}
          />
        </div>

        {/* FILTERS & PAGINATION */}
        <div className='flex justify-between items-center mt-2 text-sm text-gray-600 ml-1'>
          {/* Filter Checkboxes */}
          <div className='flex gap-4'>
            <label
              className={`flex items-center gap-1 cursor-pointer ${
                stockFilter === 'all' ? 'font-medium text-gray-900' : ''
              }`}
            >
              <input
                type='radio'
                name='stockFilter'
                checked={stockFilter === 'all'}
                onChange={() => handleFilterChange('all')}
                className='text-purple-600'
              />
              <span>всі</span>
            </label>
            <label
              className={`flex items-center gap-1 cursor-pointer ${
                stockFilter === 'inStock' ? 'font-medium text-gray-900' : ''
              }`}
            >
              <input
                type='radio'
                name='stockFilter'
                checked={stockFilter === 'inStock'}
                onChange={() => handleFilterChange('inStock')}
              />
              <span>в наявності</span>
            </label>
            <label
              className={`flex items-center gap-1 cursor-pointer ${
                stockFilter === 'outOfStock' ? 'font-medium text-gray-900' : ''
              }`}
            >
              <input
                type='radio'
                name='stockFilter'
                checked={stockFilter === 'outOfStock'}
                onChange={() => handleFilterChange('outOfStock')}
              />
              <span>нема в наявності</span>
            </label>
          </div>

          {/* Pagination Controls */}
          <div className='flex items-center gap-2'>
            <span className='text-gray-400'>|</span>

            {/* Previous Button */}
            {currentPage > 1 && (
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                className='px-2 py-1 hover:text-blue-600 transition-colors'
              >
                ←
              </button>
            )}

            {/* Page Numbers */}
            {generatePageNumbers().map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                className={`px-2 py-1 transition-colors ${
                  currentPage === pageNum
                    ? 'font-semibold text-blue-600'
                    : 'hover:text-blue-600'
                }`}
              >
                {pageNum}
              </button>
            ))}

            {/* Next Button */}
            {currentPage < pagination.pages && (
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                className='px-2 py-1 hover:text-blue-600 transition-colors'
              >
                →
              </button>
            )}

            {/* Page Info */}
            <span className='text-xs text-gray-400 ml-2'>
              (Сторінка {currentPage} з {pagination.pages}, всього:{' '}
              {pagination.total})
            </span>
          </div>
        </div>
      </div>

      {/* STATISTICS DASHBOARD */}
      <ProductStats />

      {/* ACTION TOOLBAR */}
      <div className='flex flex-wrap justify-end items-center gap-3 mb-6'>
        <button className='flex items-center bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-5 rounded-full shadow-md transition-all'>
          <PlusCircleIcon className='w-4 h-4 mr-2' />
          Закупівля товару
        </button>

        <button
          className='flex items-center bg-emerald-400 hover:bg-emerald-500 text-white font-medium py-2 px-5 rounded-full shadow-md transition-all'
          onClick={() => setIsModalOpen(true)}
        >
          <PlusCircleIcon className='w-4 h-4 mr-2' />
          Додати товар
        </button>

        <button className='flex items-center bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-5 rounded-full shadow-md transition-all'>
          <Download className='w-4 h-4 mr-2' />
          Імпорт товарів
        </button>

        <button className='p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-colors'>
          <Settings className='w-6 h-6' />
        </button>
      </div>

      {/* TABLE VIEW */}
      <div className='bg-white rounded-xl shadow-lg overflow-x-auto min-w-full'>
        <table className='min-w-full divide-y divide-gray-200'>
          <thead className='bg-gray-50 text-gray-500 uppercase text-xs font-bold tracking-wider'>
            <tr>
              <th className='px-6 py-3 text-left w-2/5 md:w-1/3'>
                <div className='flex items-center'>
                  Товар / ID{' '}
                  <span className='text-gray-400 text-xs ml-1'>/ Дата</span>
                </div>
              </th>
              <th className='px-6 py-3 text-right'>Доступно</th>
              <th className='px-6 py-3 text-right'>Продажі</th>
              <th className='px-6 py-3 text-right'>Собів. (₴)</th>
              <th className='px-6 py-3 text-right'>Ціна (₴)</th>
              <th className='px-6 py-3 text-right'>Націнка (₴)</th>
              <th className='px-6 py-3 text-right w-20'>Дії</th>
            </tr>
          </thead>

          <tbody className='bg-white divide-y divide-gray-200'>
            {typedProducts?.map((product) => (
              <ProductRow
                key={product.productId}
                product={product}
                onEdit={handleEdit}
                onCopy={handleCopy}
                onDelete={handleDelete}
              />
            ))}
          </tbody>
        </table>

        {typedProducts.length === 0 && (
          <div className='text-center py-10 text-gray-500'>
            Товари не знайдено.
          </div>
        )}
      </div>

      {/* BOTTOM PAGINATION (Optional - for better UX) */}
      {pagination.pages > 1 && (
        <div className='flex justify-center items-center gap-2 mt-6'>
          {currentPage > 1 && (
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              className='px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors'
            >
              Попередня
            </button>
          )}

          <span className='text-sm text-gray-600'>
            Сторінка {currentPage} з {pagination.pages}
          </span>

          {currentPage < pagination.pages && (
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              className='px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors'
            >
              Наступна
            </button>
          )}
        </div>
      )}

      {/* MODAL */}
      <CreateProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateProduct}
      />
    </div>
  )
}

export default Products
