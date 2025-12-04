'use client'

import { useCreateProductMutation, useGetProductsQuery } from '@/state/api'
import {
  PlusCircleIcon,
  SearchIcon,
  Download,
  Settings,
  RefreshCw,
  Pencil,
  Copy,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
//import Header from '@/app/(components)/Header'
import CreateProductModal from './CreateProductModal'
import ProductStats from './ProductStats'
import Image from 'next/image'

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

  // --- MOCK DATA for Table Columns (To be replaced with real data in Step 3) ---
  const mockCost = 100
  const mockSales = 50
  const mockMargin = (typedProducts[0]?.price || 0) - mockCost

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

      {/* --- STEP 2: TABLE SKELETON & HEADERS (NEW VIEW) --- */}
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
            {typedProducts?.slice(0, 5).map((product) => (
              // --- Start of Product Row (MOCKUP for Step 2) ---
              <tr
                key={product.productId}
                className='hover:bg-gray-50 transition-colors'
              >
                {/* 1. PRODUCT / ID / DATE */}
                <td className='px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900'>
                  <div className='flex items-center'>
                    {/* Image Placeholder/Thumbnail */}
                    <div className='flex-shrink-0 h-10 w-10 mr-3'>
                      <Image
                        src={product.mainImage || '/no_image_placeholder.png'}
                        alt={product.name}
                        width={40}
                        height={40}
                        className='rounded-md object-cover'
                      />
                    </div>
                    {/* Product Name & SKU/Date */}
                    <div className='flex flex-col'>
                      <div className='text-sm font-semibold text-gray-800'>
                        {product.name}
                      </div>
                      <div className='text-xs text-gray-500 mt-0.5'>
                        ID: {product.sku}
                      </div>
                      <div className='text-xs text-gray-400 mt-0.5'>
                        Оновлено: {product.dateModified || 'N/A'}
                      </div>
                    </div>
                  </div>
                </td>

                {/* 2. AVAILABLE */}
                <td className='px-6 py-4 whitespace-nowrap text-sm text-right'>
                  <span
                    className={`font-semibold ${
                      product.stockQuantity > 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {product.stockQuantity} pcs.
                  </span>
                </td>

                {/* 3. SALES (Mock Data) */}
                <td className='px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-semibold'>
                  {mockSales} units
                </td>

                {/* 4. COST (Mock Data) */}
                <td className='px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 font-medium'>
                  {mockCost.toFixed(2)}
                </td>

                {/* 5. PRICE */}
                <td className='px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 font-bold'>
                  {product.price.toFixed(2)}
                </td>

                {/* 6. MARGIN (Mock Data) */}
                <td className='px-6 py-4 whitespace-nowrap text-sm text-right'>
                  <span
                    className={`font-bold ${
                      mockMargin > 0 ? 'text-blue-600' : 'text-red-600'
                    }`}
                  >
                    {mockMargin.toFixed(2)}
                  </span>
                </td>

                {/* 7. ACTIONS */}
                <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium'>
                  <div className='flex justify-end gap-2'>
                    <button
                      title='Редагувати'
                      className='text-gray-400 hover:text-blue-600 p-1 rounded-full'
                    >
                      <Pencil className='w-4 h-4' />
                    </button>
                    <button
                      title='Копіювати'
                      className='text-gray-400 hover:text-blue-600 p-1 rounded-full'
                    >
                      <Copy className='w-4 h-4' />
                    </button>
                    <button
                      title='Видалити'
                      className='text-gray-400 hover:text-red-600 p-1 rounded-full'
                    >
                      <Trash2 className='w-4 h-4' />
                    </button>
                  </div>
                </td>
              </tr>
              // --- End of Product Row ---
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
