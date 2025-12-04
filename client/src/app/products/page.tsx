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
  // These fields are often calculated or specific to creation, so they are made optional
  // or removed if not needed for the table/stats component.
  inStock?: number
  available?: boolean
  priceOld?: number
  pricePromo?: number
  updatedPrice?: number
  currency?: string
  sellingType?: string
  presence?: string
  dateModified?: string
  lastSynced?: string
  needsSync?: boolean
  multilangData?: string
  categoryData?: string
  measureUnit?: string
  status?: string
  [key: string]: string | number | boolean | string[] | undefined
}

// We will use ProductType for the data coming from the API
const Products = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Data should be typed as an array of the ProductType
  const { data: products, isLoading, isError } = useGetProductsQuery(searchTerm)

  const [createProduct] = useCreateProductMutation()
  // The modal still uses the more detailed ProductFormData type for creation
  const handleCreateProduct = async (productData: ProductType) => {
    await createProduct(productData)
  }

  // --- Mock Action Handlers (We need to implement actual logic here) ---
  const handleEdit = (id: string) => console.log('Edit product:', id)
  const handleCopy = (id: string) => console.log('Copy product:', id)
  const handleDelete = (id: string) => console.log('Delete product:', id)
  // -----------------------------------------------------------------

  if (isLoading) {
    return <div className='py-4'>Loading...</div>
  }

  if (isError || !products) {
    return (
      <div className='text-center text-red-500 py-4'>
        Failed to fetch products
      </div>
    )
  }

  // Cast products to ProductType[] for safety in this file
  const typedProducts = products as ProductType[]

  return (
    <div className='mx-auto pb-5 w-full'>
      {/* --- TOP SEARCH BAR (Existing) --- */}
      <div className='mb-6'>
        <div className='flex items-center border-2 border-gray-200 rounded bg-white shadow-sm'>
          <RefreshCw className='w-5 h-5 text-gray-400 m-2 cursor-pointer hover:text-gray-600' />
          <div className='h-6 w-px bg-gray-300 mx-1'></div>
          <SearchIcon className='w-5 h-5 text-gray-400 m-2' />
          <input
            className='w-full py-2 px-2 rounded bg-white outline-none text-gray-700'
            placeholder='Пошукова фраза...'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Quick Filters (Mockup based on Image 2 top left) */}
        <div className='flex gap-4 mt-2 text-sm text-gray-600 ml-1'>
          <label className='flex items-center gap-1 cursor-pointer font-medium text-gray-900'>
            <input
              type='radio'
              name='stockFilter'
              defaultChecked
              className='text-purple-600'
            />
            <span>всі</span>
          </label>
          <label className='flex items-center gap-1 cursor-pointer'>
            <input type='radio' name='stockFilter' />
            <span>в наявності</span>
          </label>
          <label className='flex items-center gap-1 cursor-pointer'>
            <input type='radio' name='stockFilter' />
            <span>нема в наявності</span>
          </label>
          {/* Pagination Mock */}
          <span className='ml-4 text-gray-400'>|</span>
          <span className='cursor-pointer font-semibold text-blue-600'>1</span>
          <span className='cursor-pointer hover:text-blue-600'>2</span>
          <span className='cursor-pointer hover:text-blue-600'>3</span>
        </div>
      </div>

      {/* --- STEP 1: STATISTICS DASHBOARD --- */}
      <ProductStats products={typedProducts} />

      {/* --- STEP 1: ACTION TOOLBAR --- */}
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

      {/* --- STEP 2 & 3: TABLE VIEW --- */}
      <div className='bg-white rounded-xl shadow-lg overflow-x-auto min-w-full'>
        <table className='min-w-full divide-y divide-gray-200'>
          <thead className='bg-gray-50 text-gray-500 uppercase text-xs font-bold tracking-wider'>
            <tr>
              {/* Product / Date Column - Wide */}
              <th className='px-6 py-3 text-left w-2/5 md:w-1/3'>
                <div className='flex items-center'>
                  Товар / ID{' '}
                  <span className='text-gray-400 text-xs ml-1'>/ Дата</span>
                </div>
              </th>
              {/* Available Column - Narrow, Text Right */}
              <th className='px-6 py-3 text-right'>Доступно</th>
              {/* Sales Column - Narrow, Text Right */}
              <th className='px-6 py-3 text-right'>Продажі</th>
              {/* Cost Column - Narrow, Text Right */}
              <th className='px-6 py-3 text-right'>Собів. (₴)</th>
              {/* Price Column - Narrow, Text Right */}
              <th className='px-6 py-3 text-right'>Ціна (₴)</th>
              {/* Margin Column - Narrow, Text Right */}
              <th className='px-6 py-3 text-right'>Націнка (₴)</th>
              {/* Actions Column - Narrow, Text Right */}
              <th className='px-6 py-3 text-right w-20'>Дії</th>
            </tr>
          </thead>

          <tbody className='bg-white divide-y divide-gray-200'>
            {/* Map over products to create the table rows (Step 3) */}
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
            No products found.
          </div>
        )}
      </div>

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
