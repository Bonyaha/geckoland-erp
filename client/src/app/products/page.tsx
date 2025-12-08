'use client'

import { useCreateProductMutation, useGetProductsQuery } from '@/state/api'
import {
  PlusCircleIcon,
  SearchIcon,
  Download,
  Settings,
  RefreshCw,
  ArrowUpCircle,
  /* Pencil,
  Copy,
  Trash2 */
} from 'lucide-react'
//import Image from 'next/image'
import { useState, useEffect } from 'react'
//import Header from '@/app/(components)/Header'
import CreateProductModal from './CreateProductModal'
import ProductStats from './ProductStats'
import ProductRow from './ProductRow'

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
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const itemsPerPage = 20

  // 3. State to control the visibility of the scroll-to-top button
  const [showScrollArrow, setShowScrollArrow] = useState(false)

  // --- Scroll Logic ---
  const handleScroll = () => {
    // Show the button if the user has scrolled down more than 300 pixels
    if (window.scrollY > 300) {
      setShowScrollArrow(true)
    } else {
      setShowScrollArrow(false)
    }
  }
  const scrollToTop = () => {
    // Smoothly scroll the window to the top
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  useEffect(() => {
    // Attach the scroll event listener when the component mounts
    window.addEventListener('scroll', handleScroll)

    // Clean up the event listener when the component unmounts
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

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

  // --- Selection Logic ---
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked && data?.products) {
      const allIds = data.products.map((p: any) => p.productId)
      setSelectedProducts(allIds)
    } else {
      setSelectedProducts([])
    }
  }

  const handleSelectOne = (id: string) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    )
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

  const products = data.products || []
  const pagination = data.pagination || {
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  }

  const typedProducts: ProductType[] = products as ProductType[]

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
            placeholder='Пошук за назвою, ID або SKU...'
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
              {/* CHECKBOX HEADER */}
              <th className='px-4 py-3 w-10'>
                <input
                  type='checkbox'
                  className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                  onChange={handleSelectAll}
                  checked={
                    typedProducts.length > 0 &&
                    selectedProducts.length === typedProducts.length
                  }
                />
              </th>
              <th className='px-4 py-3 text-left text-blue-800 w-1/3'>
                Товар/Послуга/Дата
              </th>
              {/* Centered headers for the "Card" columns */}
              <th className='px-4 py-3 text-center text-blue-800'>Доступно</th>
              <th className='px-4 py-3 text-center text-blue-800'>Продажі</th>
              <th className='px-4 py-3 text-center text-blue-800'>Собів.</th>
              <th className='px-4 py-3 text-center text-blue-800'>Ціна</th>
              <th className='px-4 py-3 text-center text-blue-800'>Націнка</th>
            </tr>
          </thead>

          <tbody className='bg-white divide-y divide-gray-200'>
            {typedProducts?.map((product) => (
              <ProductRow
                key={product.productId}
                product={product}
                isSelected={selectedProducts.includes(product.productId)}
                onSelect={handleSelectOne}
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
      {/* SCROLL TO TOP ARROW COMPONENT */}
      {showScrollArrow && (
        <button
          onClick={scrollToTop}
          className='fixed bottom-8 right-8 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 z-50'
          aria-label='Scroll to top'
          title='Нагору' // Title for accessibility/tooltip
        >
          <ArrowUpCircle className='w-6 h-6' />
        </button>
      )}
    </div>
  )
}

export default Products
