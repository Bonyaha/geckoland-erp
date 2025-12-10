// client/src/app/products/ProductRow.tsx
import React, { useState, useMemo } from 'react'
import Image from 'next/image'
import { Pencil, Copy, Trash2, Info, Settings } from 'lucide-react'
import { formatDateTime } from '@/utils/dateUtils'
import { parseExternalIds } from '@/utils/marketplaceUtils'
import UpdateQuantityModal from './UpdateQuantityModal'
import { useUpdateProductQuantityMutation } from '@/state/api'

// Define the type for a single product, ensuring all required fields are present
type ProductType = {
  productId: string
  name: string
  price: number
  stockQuantity: number
  sku: string
  mainImage?: string
  lastSynced?: string
  externalIds?: string | Record<string, any> 
}

type ProductRowProps = {
  product: ProductType
  isSelected: boolean
  onSelect: (id: string) => void
  onEdit: (id: string) => void
  onCopy: (id: string) => void
  onDelete: (id: string) => void
}

// --- Component Definition ---

const ProductRow = ({
  product,
  isSelected,
  onSelect,
  onEdit,
  onCopy,
  onDelete,
}: ProductRowProps) => {
  // Helper function to render marketplace tags based on externalIds
  const renderMarketplaceTags = useMemo(() => {
    const ids = parseExternalIds(product.externalIds) as Record<
      string,
      any
    > | null

    const tags: React.ReactNode[] = []

    if (ids?.prom) {
      tags.push(
        <span
          key='prom'
          title={`Prom ID: ${ids.prom}`}
          className='px-1.5 py-0.5 bg-purple-600 text-white text-[10px] rounded font-bold'
        >
          Prom
        </span>
      )
    }

    if (ids?.rozetka) {
      tags.push(
        <span
          key='rozetka'
          title='Rozetka Linked'
          className='px-1.5 py-0.5 bg-green-600 text-white text-[10px] rounded font-bold'
        >
          Rozetka
        </span>
      )
    }

    // Only add settings icon if we have tags
    if (tags.length > 0) {
      tags.push(
        <Settings
          key='settings'
          className='w-4 h-4 text-blue-500 cursor-pointer'
        />
      )
    }

    return tags.length > 0 ? tags : null
  }, [product.externalIds])

const [isQuantityModalOpen, setIsQuantityModalOpen] = useState(false)
const [updateProductQuantity, { isLoading: isUpdating }] =
  useUpdateProductQuantityMutation()

const handleQuantityUpdate = async (newQuantity: number) => {
  try {
    await updateProductQuantity({
      productId: product.productId,
      quantity: newQuantity,
      targetMarketplace: 'all', // or let user choose
    }).unwrap()

    // Optional: Show success message
    console.log('Quantity updated successfully')
  } catch (error) {
    console.error('Failed to update quantity:', error)
    // Optional: Show error message to user
  }
}
  //console.log(product.lastSynced);
  // --- Local State for Inputs ---
  const [costInput, setCostInput] = useState<string>('')
  // Calculations based on mock data
  const cost = costInput ? parseFloat(costInput) : 0
  const sales = Math.floor(Math.random() * 50) // Mock sales
  //const margin = product.price - cost
  const marginValue = product.price - cost
  const marginPercent =
    product.price > 0 ? (marginValue / product.price) * 100 : 0
  const salesDate = '06.09' // Mock date

  // Utility for formatting currency
  const formatCurrency = (value: number) => value.toFixed(2)

  return (
    <tr
      key={product.productId}
      className={`hover:bg-gray-50 transition-colors border-b border-gray-100 ${
        isSelected ? 'bg-blue-50' : ''
      }`}
    >
      {/* 1. CHECKBOX */}
      <td className='px-4 py-4 align-top w-10'>
        <input
          type='checkbox'
          checked={isSelected}
          onChange={() => onSelect(product.productId)}
          className='mt-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer'
        />
      </td>
      {/* 2. PRODUCT INFO (Wide Column) */}
      <td className='px-4 py-4 align-top max-w-md'>
        <div className='flex gap-3'>
          {/* Image Placeholder/Thumbnail */}
          <div className='flex-shrink-0 h-16 w-16 bg-gray-200 rounded-md overflow-hidden relative'>
            <Image
              src={
                product.mainImage ||
                'https://placehold.co/64x64/e2e8f0/94a3b8.png?text=IMG'
              }
              alt={product.name}
              fill
              sizes='64px'
              className='object-cover'
            />
          </div>

          {/* Details */}
          <div className='flex flex-col gap-1 w-full'>
            <div className='text-sm font-bold text-blue-700 leading-tight hover:underline cursor-pointer'>
              {product.name}
            </div>
            <div className='text-xs text-gray-500'>
              ID: {product.productId} | Артикул: {product.sku}
              {/* Optional Category Data */}
              {/* | Категорія: {product.category || 'Reptiles'} */}
            </div>
            <div className='text-xs text-gray-400 mt-0.5'>
              Оновлено: {formatDateTime(product.lastSynced)}
            </div>
            {/* ACTION BAR (Moved here from separate column) */}
            <div className='flex flex-wrap items-center gap-2 mt-2'>
              <button className='px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-full transition-colors cursor-pointer'>
                Додати продаж
              </button>

              <button
                title='Info'
                className='p-1.5 bg-blue-500 text-white rounded-full hover:bg-blue-600'
              >
                <Info className='w-3 h-3' />
              </button>

              {/* Standard Actions */}
              <button
                onClick={() => onEdit(product.productId)}
                className='p-1 text-blue-600 hover:bg-blue-100 rounded'
              >
                <Pencil className='w-4 h-4' />
              </button>
              <button
                onClick={() => onCopy(product.productId)}
                className='p-1 text-blue-600 hover:bg-blue-100 rounded'
              >
                <Copy className='w-4 h-4' />
              </button>
              <button
                onClick={() => onDelete(product.productId)}
                className='p-1 text-blue-600 hover:bg-blue-100 rounded'
              >
                <Trash2 className='w-4 h-4' />
              </button>

              {/* Marketplace Tags (Mock UI) */}
              <div className='flex gap-1 ml-auto'>{renderMarketplaceTags}</div>
            </div>
          </div>
        </div>
      </td>

      {/* 3. AVAILABLE ("Card" Style) */}
      <td className='px-2 py-4 align-top'>
        <div className='flex flex-col items-center justify-center p-3 rounded-xl bg-gray-50 border border-gray-100 shadow-sm h-full min-w-[100px]'>
          <span className='text-xs text-gray-500 font-medium mb-1'>
            Доступно
          </span>
          <span
            className={`text-2xl font-bold ${
              product.stockQuantity > 0 ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {product.stockQuantity}
          </span>
          <span className='text-xs text-gray-500 mb-2'>одиниць</span>

          {/* Action Trigger Image 4 */}
          <button
            onClick={() => setIsQuantityModalOpen(true)}
            disabled={isUpdating}
            className='text-xs text-blue-500 hover:text-blue-700 hover:underline border-t border-dashed border-blue-300 pt-1 w-full text-center cursor-pointer'
          >
            {isUpdating ? 'Оновлення...' : 'Додати\\Зменшити'}
          </button>
        </div>
      </td>

      {/* 4. SALES ("Card" Style) */}
      <td className='px-2 py-4 align-top'>
        <div className='flex flex-col items-center justify-center p-3 rounded-xl bg-gray-50 border border-gray-100 shadow-sm h-full min-w-[100px]'>
          <span className='text-xs text-gray-500 font-medium mb-1'>
            Кількість
          </span>
          <span className='text-2xl font-bold text-red-500'>{sales}</span>
          <span className='text-xs text-gray-500 mb-2'>продажів</span>
          {/* Action Trigger Image 5 */}
          <button className='text-xs text-blue-500 hover:text-blue-700 hover:underline w-full text-center'>
            з {salesDate}
          </button>
        </div>
      </td>

      {/* 5. COST ("Card" Style - Input) */}
      <td className='px-2 py-4 align-top'>
        <div className='flex flex-col items-center justify-center gap-2 p-3 h-full min-w-[120px]'>
          {/* Input Box Image 6 */}
          <input
            type='number'
            placeholder='0'
            className='w-20 px-2 py-1 text-center text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500'
            value={cost}
            onChange={(e) => setCostInput(e.target.value)}
          />
          <button className='text-xs text-blue-500 hover:underline cursor-pointer'>
            Розрахувати
          </button>
          {/* {formatCurrency(cost)} */}
        </div>
      </td>

      {/* 6. PRICE ("Card" Style) */}
      <td className='px-2 py-4 align-top'>
        <div className='flex flex-col items-center justify-center p-3 rounded-xl bg-gray-50 border border-gray-100 shadow-sm h-full min-w-[100px]'>
          <span className='text-xs text-gray-500 font-medium mb-1'>Продаж</span>
          <span className='text-xl font-bold text-green-600'>
            {product.price}
          </span>
          {/* {formatCurrency(product.price)} */}
          <span className='text-xs text-gray-500'>грн.</span>
        </div>
      </td>

      {/* 7. MARGIN (Blue/Red text, Bold) */}
      <td className='px-2 py-4 align-top'>
        <div className='flex flex-col items-center justify-center p-3 rounded-xl bg-gray-50 border border-gray-100 shadow-sm h-full min-w-[120px]'>
          <span className='text-xs text-gray-500 font-medium mb-1'>
            Націнка
          </span>
          <span className='text-lg font-bold text-green-500'>
            {formatCurrency(marginValue)} грн.
          </span>
          <span className='text-sm font-bold text-green-400'>
            ({marginPercent.toFixed(0)}%)
          </span>
        </div>
        <UpdateQuantityModal
          isOpen={isQuantityModalOpen}
          onClose={() => setIsQuantityModalOpen(false)}
          onUpdate={handleQuantityUpdate}
          currentQuantity={product.stockQuantity}
          productName={product.name}
        />
      </td>
    </tr>
  )
}

export default ProductRow
