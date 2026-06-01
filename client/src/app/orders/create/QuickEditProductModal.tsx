// client/src/app/orders/create/QuickEditProductModal.tsx
'use client'

import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { useUpdateProductMutation } from '@/state/api'

interface QuickEditProductModalProps {
  productId: string
  productName: string
  currentQuantity: number
  currentCostPrice: number
  currentPrice: number
  onClose: () => void
  onSaved: (newQuantity: number) => void
}

const QuickEditProductModal = ({
  productId,
  productName,
  currentQuantity,
  currentCostPrice,
  currentPrice,
  onClose,
  onSaved,
}: QuickEditProductModalProps) => {
  const [quantity, setQuantity] = useState<string>(String(currentQuantity))
  const [costPrice, setCostPrice] = useState<string>(
    currentCostPrice > 0 ? String(currentCostPrice) : '',
  )
  const [price, setPrice] = useState<string>(String(currentPrice))

  const [updateProduct, { isLoading }] = useUpdateProductMutation()

  const handleSave = async () => {
    const newQty = parseInt(quantity, 10)
    if (isNaN(newQty) || newQty < 0) return

    try {
      await updateProduct({
        productId,
        quantity: newQty,
        costPrice: costPrice ? parseFloat(costPrice) : undefined,
        price: parseFloat(price) || currentPrice,
        internalOnly: true, // no marketplace sync
      }).unwrap()

      onSaved(newQty)
      onClose()
    } catch (err) {
      console.error('Failed to update product:', err)
    }
  }

  return (
    <div
      className='fixed inset-0 bg-black/50 z-300 flex items-center justify-center p-4'
      onClick={onClose}
    >
      <div
        className='bg-white rounded-xl w-full max-w-sm shadow-2xl'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className='flex items-center justify-between px-5 py-4 border-b border-gray-200'>
          <h2 className='text-base font-bold text-gray-900'>
            Редагування товару
          </h2>
          <button
            onClick={onClose}
            className='p-1.5 hover:bg-gray-100 rounded-full transition-colors'
          >
            <X size={18} className='text-gray-500' />
          </button>
        </div>

        {/* Form */}
        <div className='p-5 space-y-4'>
          {/* Product name — read-only */}
          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>
              Назва товару
            </label>
            <p className='text-sm text-gray-800 font-medium leading-snug'>
              {productName}
            </p>
          </div>

          {/* Quantity */}
          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>
              Од. на складі <span className='text-red-500'>*</span>
            </label>
            <input
              type='number'
              min='0'
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onFocus={(e) => e.target.select()}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm'
            />
          </div>

          {/* Cost price */}
          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>
              Собівартість (грн)
            </label>
            <input
              type='number'
              min='0'
              step='0.01'
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder='0.00'
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm'
            />
          </div>

          {/* Sale price */}
          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>
              Ціна продажу (грн) <span className='text-red-500'>*</span>
            </label>
            <input
              type='number'
              min='0'
              step='0.01'
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onFocus={(e) => e.target.select()}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm'
            />
          </div>
        </div>

        {/* Footer */}
        <div className='px-5 py-4 border-t border-gray-100 flex gap-3'>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className='flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm'
          >
            <Save size={15} />
            {isLoading ? 'Збереження...' : 'Зберегти'}
          </button>
          <button
            onClick={onClose}
            className='px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm'
          >
            Скасувати
          </button>
        </div>
      </div>
    </div>
  )
}

export default QuickEditProductModal
