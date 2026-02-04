//  client/src/app/products/page.tsx
'use client'

import {
  useCreateProductMutation,
  useGetProductsQuery,
  useBatchUpdateProductMutation,
  useSyncProductsFromMarketplacesMutation,
  useGetProductsSalesQuery,
} from '@/state/api'
import {
  PlusCircleIcon,
  SearchIcon,
  Download,
  Calculator,
  Settings,
  RefreshCw,
  ArrowUp,
  Edit3,
  DollarSign,
  /* CheckCircle */
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
//import Image from 'next/image'
import { useState, useEffect, useMemo } from 'react'
//import Header from '@/app/(components)/Header'
import CreateProductModal from './CreateProductModal'
import ProductStats from './ProductStats'
import ProductRow from './ProductRow'
import BatchUpdateModal from './BatchUpdateModal'
import Toast from '@/app/(components)/Toast'
import { useToast } from '@/hooks/useToast'

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
  costPrice?: number
  [key: string]: string | number | boolean | string[] | undefined
}

type UpdateMode = 'quantity' | 'price' | 'costPrice'
type CalculationMethod = 'absolute' | 'relative' | 'percent' | 'formula'
type SortField = 'name' | 'price' | 'stockQuantity' | 'costPrice'
type SortDirection = 'asc' | 'desc' | null

const Products = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [stockFilter, setStockFilter] = useState<
    'all' | 'inStock' | 'outOfStock'
  >('all')
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [showScrollArrow, setShowScrollArrow] = useState(false)  
  const [batchMode, setBatchMode] = useState<
    'quantity' | 'price' | 'costPrice'
  >('quantity')
  /* const [notificationMessage, setNotificationMessage] = useState<string | null>(
    null
  ) */
  const { toast, showToast, hideToast } = useToast()
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [salesDateFilters, setSalesDateFilters] = useState<
    Record<string, string>
  >({})

  const itemsPerPage = 20

  // API hooks
  const { data, isLoading, isError } = useGetProductsQuery({
    search: searchTerm,
    page: currentPage,
    limit: itemsPerPage,
    stockFilter,
  })

  // Get product IDs for sales query
  const productIds = useMemo(() => {
    return data?.products?.map((p: any) => p.productId) || []
  }, [data?.products])

  // Get the earliest date filter from all products (if any)
  const earliestDateFilter = useMemo(() => {
    const dates = Object.values(salesDateFilters).filter(Boolean)
    if (dates.length === 0) return undefined

    // Find the earliest date
    const earliestDate = dates.reduce((earliest, current) => {
      return new Date(current) < new Date(earliest) ? current : earliest
    })

    return earliestDate
  }, [salesDateFilters])

  // Fetch sales data for current products
  const { data: salesData } = useGetProductsSalesQuery(
    { productIds, startDate: earliestDateFilter },
    { skip: productIds.length === 0 },
  )

  const [createProduct] = useCreateProductMutation()
  const [batchUpdateProduct, { isLoading: isBatchUpdating }] =
    useBatchUpdateProductMutation()
  const [syncProducts, { isLoading: isSyncing }] =
    useSyncProductsFromMarketplacesMutation()

  // --- Scroll Logic ---
  const handleScroll = () => {
    // Show the button if the user has scrolled down more than 400 pixels
    if (window.scrollY > 400) {
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

  //NEW
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortDirection(null)
        setSortField(null)
      }
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className='w-4 h-4 text-gray-400' />
    }

    if (sortDirection === 'asc') {
      return <ChevronUp className='w-4 h-4 text-blue-600' />
    }

    return <ChevronDown className='w-4 h-4 text-blue-600' />
  }

  const sortedProducts = useMemo(() => {
    if (!data?.products) return []

    const products = [...data.products]

    if (!sortField || !sortDirection) {
      return products
    }

    return products.sort((a, b) => {
      let aValue = a[sortField]
      let bValue = b[sortField]

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = 0
      if (bValue === null || bValue === undefined) bValue = 0

      // String comparison for name
      if (sortField === 'name') {
        const aStr = String(aValue).toLowerCase()
        const bStr = String(bValue).toLowerCase()

        if (sortDirection === 'asc') {
          return aStr.localeCompare(bStr, 'uk')
        }
        return bStr.localeCompare(aStr, 'uk')
      }

      // Numeric comparison for price, stockQuantity, costPrice
      const aNum = Number(aValue)
      const bNum = Number(bValue)

      if (sortDirection === 'asc') {
        return aNum - bNum
      }
      return bNum - aNum
    })
  }, [data?.products, sortField, sortDirection])

  const handleCreateProduct = async (productData: ProductType) => {
    await createProduct(productData)
  }

  // Action handlers
  const handleEdit = (id: string) => console.log('Edit product:', id)
  const handleCopy = (id: string) => console.log('Copy product:', id)
  const handleDelete = (id: string) => console.log('Delete product:', id)

  const handleMarketplaceSync = async () => {
    try {
      showToast('Синхронізація з маркетплейсами...', 'info')

      const result = await syncProducts().unwrap()

      showToast(
        `✅ Синхронізація завершена! Prom: ${result.productsCreatedFromProm}, Rozetka: ${result.productsCreatedFromRozetka}, Всього: ${result.totalCreated}`,
        'success',
      )     

      // If there were errors, log them
      if (result.errors.length > 0) {
        console.error('Sync errors:', result.errors)
      }
    } catch (error) {
      console.error('Failed to sync products:', error)
      showToast('❌ Помилка синхронізації. Спробуйте ще раз.', 'error')
    }
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
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id],
    )
  }

  // Batch Update Logic
  const handleBatchUpdate = async (
    newValue: number,
    mode: UpdateMode,
    method: CalculationMethod,
  ) => {
    if (selectedProducts.length === 0) return

    try {
      // Get current product data to calculate relative/percent updates
      const currentProducts = data?.products.filter((p: any) =>
        selectedProducts.includes(p.productId),
      )

      if (!currentProducts) return

      const products = currentProducts.map((product: any) => {
        let finalValue = newValue

        // For relative/percent methods, calculate the final value based on current value
        if (method === 'relative' || method === 'percent') {
          const currentValue =
            mode === 'price'
              ? product.price
              : mode === 'costPrice'
                ? product.costPrice || 0
                : product.stockQuantity

          if (method === 'relative') {
            finalValue = currentValue + newValue
          } else if (method === 'percent') {
            finalValue = currentValue * (1 + newValue / 100)
          }

          // Ensure non-negative values
          finalValue = Math.max(0, finalValue)

          // Round quantity to integer
          if (mode === 'quantity') {
            finalValue = Math.round(finalValue)
          }
        }

        // Build the updates object with correct field names
        const updates: any = {}

        if (mode === 'price') {
          updates.price = finalValue
        } else if (mode === 'costPrice') {
          updates.costPrice = finalValue
        } else if (mode === 'quantity') {
          updates.quantity = finalValue
        }

        return {
          productId: product.productId,
          updates,
        }
      })

      await batchUpdateProduct({
        products,
        targetMarketplace: 'all',
      }).unwrap()

      showToast(
        `Успішно оновлено ${selectedProducts.length} товарів`,
        'success',
      )

      setSelectedProducts([])
      setIsBatchModalOpen(false)
    } catch (error) {
      console.error('Failed to batch update:', error)
      showToast('Помилка групового оновлення', 'error')
    }
  }

  // Get selected products for batch modal
  const getSelectedProductsData = () => {
    if (!data?.products) return []
    return data.products
      .filter((p: any) => selectedProducts.includes(p.productId))
      .map((p: any) => ({
        productId: p.productId,
        name: p.name,
        currentValue:
          batchMode === 'price'
            ? p.price
            : batchMode === 'costPrice'
              ? p.costPrice || 0
              : p.stockQuantity,
      }))
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

  //const products = data.products || []
  const pagination = data.pagination || {
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  }

  const typedProducts: ProductType[] = sortedProducts as ProductType[]
  console.log('Typed products:', typedProducts[0])

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

  const handleCostUpdateNotification = (productName: string) => {
    showToast(`Собівартість для "${productName}" збережена!`, 'success')
  }

  const handleSalesDateChange = (productId: string, date: Date) => {
    setSalesDateFilters((prev) => ({
      ...prev,
      [productId]: date.toISOString(),
    }))
  }

  const handleClearSalesDate = (productId: string) => {
    setSalesDateFilters((prev) => {
      const newFilters = { ...prev }
      delete newFilters[productId]
      return newFilters
    })
  }

  return (
    <div className='mx-auto pb-5 w-full'>
      {/* TOP SEARCH BAR */}
      <div className='mb-6'>
        <div className='flex items-center border-2 border-gray-200 rounded bg-white shadow-sm'>
          <button
            type='button'
            onClick={isSyncing ? undefined : handleMarketplaceSync}
            title={
              isSyncing ? 'Синхронізація...' : 'Синхронізація з маркетплейсами'
            }
            className='m-2 focus:outline-none cursor-pointer' // Moved margin here to preserve layout
          >
            <RefreshCw
              className={`w-5 h-5 transition-colors ${
                isSyncing
                  ? 'text-blue-600 animate-spin'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            />
          </button>
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
                className='px-2 py-1 hover:text-blue-600 transition-colors cursor-pointer'
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
                } cursor-pointer`}
              >
                {pageNum}
              </button>
            ))}

            {/* Next Button */}
            {currentPage < pagination.pages && (
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                className='px-2 py-1 hover:text-blue-600 transition-colors cursor-pointer'
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
      <div className='flex flex-wrap justify-between items-center gap-3 mb-6'>
        {/* LEFT: Batch Actions (shown when products are selected) */}
        <div className='flex items-center gap-3'>
          {selectedProducts.length > 0 && (
            <>
              <span className='text-sm font-medium text-gray-700'>
                Вибрано: {selectedProducts.length}
              </span>

              {/* Quantity Button */}
              <button
                onClick={() => {
                  setBatchMode('quantity')
                  setIsBatchModalOpen(true)
                }}
                disabled={isBatchUpdating}
                className='flex items-center bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 px-5 rounded-full shadow-md transition-all disabled:bg-gray-400 cursor-pointer'
              >
                <Edit3 className='w-4 h-4 mr-2' />
                Кількість
              </button>

              {/* Price Button */}
              <button
                onClick={() => {
                  setBatchMode('price')
                  setIsBatchModalOpen(true)
                }}
                disabled={isBatchUpdating}
                className='flex items-center bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-5 rounded-full shadow-md transition-all disabled:bg-gray-400 cursor-pointer'
              >
                <DollarSign className='w-4 h-4 mr-2' />
                Ціна
              </button>

              {/* Cost Price Button */}
              <button
                onClick={() => {
                  setBatchMode('costPrice')
                  setIsBatchModalOpen(true)
                }}
                disabled={isBatchUpdating}
                className='flex items-center bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-5 rounded-full shadow-md transition-all disabled:bg-gray-400 cursor-pointer'
              >
                <Calculator className='w-4 h-4 mr-2' />
                Собівартість
              </button>
              <button
                onClick={() => setSelectedProducts([])}
                className='text-sm text-gray-600 hover:text-gray-800 underline cursor-pointer'
              >
                Скасувати
              </button>
            </>
          )}
        </div>

        {/* RIGHT: Regular Actions */}
        <div className='flex items-center gap-3'>
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
      </div>

      {/* TABLE VIEW */}
      <div className='bg-white rounded-xl shadow-lg overflow-x-auto min-w-full'>
        <table className='min-w-full divide-y divide-gray-200'>
          <thead className='bg-gray-50 uppercase text-sm font-bold tracking-wider'>
            <tr>
              {/* CHECKBOX HEADER */}
              <th className='px-4 py-3 w-10'>
                <input
                  type='checkbox'
                  className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer'
                  onChange={handleSelectAll}
                  checked={
                    typedProducts.length > 0 &&
                    selectedProducts.length === typedProducts.length
                  }
                />
              </th>

              {/* SORTABLE COLUMNS */}
              <th
                className='px-4 py-3 text-center text-black font-bold w-1/3 cursor-pointer hover:bg-gray-100 transition-colors'
                onClick={() => handleSort('name')}
              >
                <div className='flex items-center justify-center gap-2'>
                  <span>Товар</span>
                  <SortIcon field='name' />
                </div>
              </th>

              <th
                className='px-4 py-3 text-center text-black font-bold cursor-pointer hover:bg-gray-100 transition-colors'
                onClick={() => handleSort('price')}
              >
                <div className='flex items-center justify-center gap-2'>
                  <span>Ціна</span>
                  <SortIcon field='price' />
                </div>
              </th>

              <th
                className='px-4 py-3 text-center text-black font-bold cursor-pointer hover:bg-gray-100 transition-colors'
                onClick={() => handleSort('stockQuantity')}
              >
                <div className='flex items-center justify-center gap-2'>
                  <span>Доступно</span>
                  <SortIcon field='stockQuantity' />
                </div>
              </th>

              <th className='px-4 py-3 text-center text-black font-bold'>
                Продажі
              </th>

              <th
                className='px-4 py-3 text-center text-black font-bold cursor-pointer hover:bg-gray-100 transition-colors'
                onClick={() => handleSort('costPrice')}
              >
                <div className='flex items-center justify-center gap-2'>
                  <span>Собів.</span>
                  <SortIcon field='costPrice' />
                </div>
              </th>
              <th className='px-4 py-3 text-center text-black font-bold'>
                Націнка
              </th>
            </tr>
          </thead>

          <tbody className='bg-white divide-y divide-gray-200'>
            {typedProducts?.map((product) => (
              <ProductRow
                key={product.productId}
                product={product}
                salesData={salesData?.[product.productId]}
                salesDateFilter={salesDateFilters[product.productId]}
                isSelected={selectedProducts.includes(product.productId)}
                onSelect={handleSelectOne}
                onEdit={handleEdit}
                onCopy={handleCopy}
                onDelete={handleDelete}
                onCostUpdate={handleCostUpdateNotification}
                onSalesDateChange={handleSalesDateChange}
                onClearSalesDate={handleClearSalesDate}
                showToast={showToast}
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

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />

      {/* BOTTOM PAGINATION (Optional - for better UX) */}
      {pagination.pages > 1 && (
        <div className='flex justify-center items-center gap-2 mt-6'>
          {currentPage > 1 && (
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              className='px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors cursor-pointer'
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
              className='px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors cursor-pointer'
            >
              Наступна
            </button>
          )}
        </div>
      )}

      {/* MODALS */}
      <CreateProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateProduct}
      />
      <BatchUpdateModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        onUpdate={handleBatchUpdate}
        selectedProducts={getSelectedProductsData()}
        mode={batchMode}
      />
      {/* SCROLL TO TOP ARROW COMPONENT */}
      {showScrollArrow && (
        <button
          onClick={scrollToTop}
          className='fixed bottom-8 right-8 p-3 bg-blue-400 text-white rounded-lg shadow-lg hover:bg-blue-500 transition-all duration-300 z-50 cursor-pointer'
          aria-label='Scroll to top'
          title='Нагору' // Title for accessibility/tooltip
        >
          <ArrowUp className='w-6 h-6' />
        </button>
      )}
    </div>
  )
}

export default Products
