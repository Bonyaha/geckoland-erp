// client/src/app/products/ProductRow.tsx
import React, { useState, useMemo } from 'react'
import Image from 'next/image'
import {
  Pencil,
  Copy,
  Trash2,
  Info,
  Settings,
  Loader2,  
} from 'lucide-react'
import { formatDateTime } from '@/utils/dateUtils'
import {
  parseExternalIds,
  getPromEditUrl,
  getRozetkaProductUrl,
  openInNewTab,
} from '@/utils/marketplaceUtils'
import UpdateQuantityModal from './UpdateQuantityModal'
import UpdateCostPriceModal from './UpdateCostPriceModal'
import UpdatePriceModal from './UpdatePriceModal'
import { useUpdateProductMutation } from '@/state/api'

// --- Type Definitions ---
// Define the type for category data
type CategoryData = {
  id: number | string
  name: string
}
// Define the type for a single product, ensuring all required fields are present
type ProductType = {
  productId: string
  name: string
  price: number
  costPrice?: number | null
  stockQuantity: number
  sku: string
  mainImage?: string
  lastSynced?: string
  externalIds?: string | Record<string, any>
  categoryData?: {
    prom?: CategoryData
    rozetka?: CategoryData
  }
}

type ProductRowProps = {
  product: ProductType
  isSelected: boolean
  onSelect: (id: string) => void
  onEdit: (id: string) => void
  onCopy: (id: string) => void
  onDelete: (id: string) => void
  onCostUpdate?: (productName: string) => void
}

// --- Component Definition ---

const ProductRow = ({
  product,
  isSelected,
  onSelect,
  onEdit,
  onCopy,
  onDelete,
  onCostUpdate,
}: ProductRowProps) => {
  //console.log('product is: ',product);

  const [updateProduct, { isLoading: isUpdating }] = useUpdateProductMutation()
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false)
  //const [costInput, setCostInput] = useState<string>('')
  const [isCostModalOpen, setIsCostModalOpen] = useState(false)
  const [isQuantityModalOpen, setIsQuantityModalOpen] = useState(false)
  const [manualCost, setManualCost] = useState<string>('')
  //const [showNotification, setShowNotification] = useState(false)

  const cardButtonClass =
    'text-xs bg-white border border-gray-200 text-blue-600 px-3 py-1 rounded-md hover:bg-blue-50 transition-colors shadow-sm w-full max-w-[110px] cursor-pointer'

  const hasCostPrice =
    product.costPrice !== null &&
    product.costPrice !== undefined &&
    product.costPrice > 0

// Handler for marketplace tag clicks
  const handleMarketplaceClick = (marketplace: 'prom' | 'rozetka', id: string) => {
    const url = marketplace === 'prom' 
      ? getPromEditUrl(id) 
      : getRozetkaProductUrl(id)
    
    openInNewTab(url)
  }

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
          title={`Prom ID: ${ids.prom}\nНатисни, щоб відкрити в Prom маркетплейсі`}
          onClick={(e) => {
            e.stopPropagation() // Prevent row selection
            handleMarketplaceClick('prom', ids.prom)
          }}
          className='px-1.5 py-0.5 bg-purple-600 text-white text-[10px] rounded font-bold cursor-pointer hover:bg-purple-700 transition-colors'
        >
          Prom          
        </span>
      )
    }

    if (ids?.rozetka) {
      tags.push(
        <span
          key='rozetka'
          title={`Rozetka ID: ${ids.rozetka.rz_item_id}\nНатисни, щоб відкрити в Rozetka маркетплейсі`}
          onClick={(e) => {
            e.stopPropagation() // Prevent row selection
            handleMarketplaceClick('rozetka', ids.rozetka.rz_item_id)
          }}
          className='px-1.5 py-0.5 bg-green-600 text-white text-[10px] rounded font-bold cursor-pointer hover:bg-green-700 transition-colors'
        >
          Rozetka          
        </span>
      )
    }

    // Only add settings icon if we have tags
    if (tags.length > 0) {
      tags.push(
        <span
          key='settings'
          className='cursor-pointer group' // Use a group for hover effects
          onClick={(e) => {
            e.stopPropagation()
            console.log('Settings clicked for product:', product.productId)
          }}
          title='Product settings' // Title works perfectly on a span
        >
          <Settings className='w-4 h-4 text-blue-500 group-hover:text-blue-600 transition-colors' />
        </span>
      )
    }
    return tags.length > 0 ? tags : null
  }, [product.externalIds, product.productId])

  const handleQuantityUpdate = async (newQuantity: number) => {
    try {
      await updateProduct({
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

  const handlePriceUpdate = async (newPrice: number) => {
    try {
      // We use the same mutation but pass 'price' instead of 'quantity'
      await updateProduct({
        productId: product.productId,
        price: newPrice,
        targetMarketplace: 'all',
      }).unwrap()
    } catch (error) {
      console.error('Failed to update price:', error)
    }
  }

  const handleManualCostSave = async () => {
    const value = parseFloat(manualCost)
    if (!isNaN(value) && value >= 0) {
      try {
        await updateProduct({
          productId: product.productId,
          costPrice: value,
          targetMarketplace: 'all',
        }).unwrap()
        setManualCost('') // Reset input on success

        // Trigger notification in parent
        if (onCostUpdate) {
          onCostUpdate(product.name)
        }        
      } catch (error) {
        console.error('Failed to update cost price manually:', error)
      }
    }
  }

  const handleCostUpdate = async (newCost: number) => {
    try {
      await updateProduct({
        productId: product.productId,
        costPrice: newCost,
        targetMarketplace: 'all',
      }).unwrap()
      // Trigger notification in parent
      if (onCostUpdate) {
        onCostUpdate(product.name)
      }
    } catch (error) {
      console.error('Failed to update cost:', error)
    }
  }

  // Calculations based on mock data
  const cost = product.costPrice ? product.costPrice : 0
  const sales = Math.floor(Math.random() * 50) // Mock sales
  //const margin = product.price - cost
  const marginValue = product.price - cost
  const marginPercent =
    product.price > 0 ? (marginValue / product.price) * 100 : 0
  const salesDate = '06.09' // Mock date

  // Utility for formatting currency
  const formatCurrency = (value: number) => value.toFixed(2)

  // Logic to build the category string
  const categoryDisplay = useMemo(() => {
    if (!product.categoryData) return null

    const items: React.ReactNode[] = []

    // Check for Prom
    if (product.categoryData.prom?.name) {
      items.push(
        <span key='prom'>
          <span className='underline'>Пром</span>:{' '}
          {product.categoryData.prom.name}
        </span>
      )
    }

    // Check for Rozetka
    if (product.categoryData.rozetka?.name) {
      items.push(
        <span key='rozetka'>
          <span className='underline'>Розетка</span>:{' '}
          {product.categoryData.rozetka.name}
        </span>
      )
    }

    if (items.length === 0) return null

    // Join with a separator (e.g., " / ")
    return items.reduce((prev, curr) => [prev, ' / ', curr])
  }, [product.categoryData])

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
            <div className='text-lg font-bold text-blue-700 leading-tight hover:underline cursor-pointer'>
              {product.name}
            </div>
            <div className='text-sm text-gray-500'>
              ID: {product.productId} | Артикул: {product.sku}
            </div>
            <div className='text-sm text-gray-500'>
              {categoryDisplay && <> Категорія: {categoryDisplay}</>}
            </div>
            <div className='text-sm text-gray-400 mt-0.5'>
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

      {/* 6. PRICE ("Card" Style) */}
      <td className='px-2 py-4 align-top'>
        <div className='flex flex-col items-center justify-center p-3 rounded-xl bg-gray-50 border border-gray-100 shadow-sm h-full min-w-[100px]'>
          <span className='text-xl font-bold text-green-600'>
            {product.price?.toFixed(2)}{' '}
            <span className='text-black text-xs font-light'>грн.</span>
          </span>
          {/* {formatCurrency(product.price)} */}
          <button
            onClick={() => setIsPriceModalOpen(true)}
            className={cardButtonClass}
          >
            Змінити
          </button>
        </div>
      </td>

      {/* 3. AVAILABLE ("Card" Style) */}
      <td className='px-2 py-4 align-top'>
        <div className='flex flex-col items-center justify-center p-3 rounded-xl bg-gray-50 border border-gray-100 shadow-sm h-full min-w-[100px]'>
          <span
            className={`text-2xl font-bold ${
              product.stockQuantity > 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {product.stockQuantity}
          </span>
          <span className='text-xs text-gray-500 mb-2'>одиниць</span>

          {/* Action Trigger*/}
          <button
            onClick={() => setIsQuantityModalOpen(true)}
            disabled={isUpdating}
            className={cardButtonClass}
          >
            {isUpdating ? 'Оновлення...' : 'Додати\\Зменшити'}
          </button>
        </div>
      </td>
      {/* 5. COST ("Card" Style - Input) */}
      <td className='px-2 py-4 align-top'>
        <div className='flex flex-col items-center justify-center p-3 rounded-xl bg-gray-50 border border-gray-100 shadow-sm h-full min-w-[100px]'>
          <span className='text-xs text-gray-500 font-medium mb-1'>
            Собівартість
          </span>
          {hasCostPrice ? (
            /* VIEW MODE: When cost price exists */
            <>
              <span className='text-lg font-bold text-green-600 mb-2'>
                {product.costPrice?.toFixed(2)}{' '}
                <span className='text-black text-xs font-light'>грн.</span>
              </span>
              <button
                onClick={() => setIsCostModalOpen(true)}
                className={cardButtonClass}
              >
                Змінити
              </button>
            </>
          ) : (
            /* INPUT MODE: When cost price is missing */
            <>
              <div className='relative w-full flex items-center mb-2'>
                <input
                  type='number'
                  placeholder='0.00'
                  className='w-full text-center text-sm border border-gray-300 rounded-md mb-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none'
                  value={manualCost}
                  onChange={(e) => setManualCost(e.target.value)}
                  onBlur={handleManualCostSave}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualCostSave()}
                  disabled={isUpdating}
                />
                {isUpdating && (
                  <div className='absolute right-2'>
                    <Loader2 className='w-3 h-3 text-blue-500 animate-spin' />
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsCostModalOpen(true)}
                className={cardButtonClass}
              >
                Розрахувати
              </button>
            </>
          )}
        </div>
      </td>
      {/* 4. SALES ("Card" Style) */}
      <td className='px-2 py-4 align-top'>
        <div className='flex flex-col items-center justify-center p-3 rounded-xl bg-gray-50 border border-gray-100 shadow-sm h-full min-w-[100px]'>
          <span className='text-xs text-gray-500 font-medium mb-1'>
            Кількість продажів
          </span>

          <span className='text-2xl font-bold text-green-600'>{sales}</span>

          {/* Action Trigger Image 5 */}
          <button className='text-xs text-blue-500 hover:text-blue-700 hover:underline w-full text-center cursor-pointer'>
            з {salesDate}
          </button>
        </div>
      </td>

      {/* 7. MARGIN (Blue/Red text, Bold) */}
      <td className='px-2 py-4 align-top'>
        <div className='flex flex-col items-center justify-center p-3 rounded-xl bg-gray-50 border border-gray-100 shadow-sm h-full min-w-[120px]'>
          <span className='text-xs text-gray-500 font-medium mb-1'>
            Націнка
          </span>
          <span className='text-lg font-bold text-green-600'>
            {formatCurrency(marginValue)}{' '}
            <span className='text-black text-xs font-light'>грн.</span>
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
        <UpdatePriceModal
          isOpen={isPriceModalOpen}
          onClose={() => setIsPriceModalOpen(false)}
          onUpdate={handlePriceUpdate}
          currentPrice={product.price}
          productName={product.name}
        />
        <UpdateCostPriceModal
          isOpen={isCostModalOpen}
          onClose={() => setIsCostModalOpen(false)}
          onUpdate={handleCostUpdate}
          productName={product.name}
          currentCost={product.costPrice || 0}
        />
      </td>
    </tr>
  )
}

export default ProductRow
