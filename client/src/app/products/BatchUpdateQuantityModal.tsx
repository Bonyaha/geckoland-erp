import React, { useState, useEffect } from 'react'
import { X, Plus, Minus, AlertCircle } from 'lucide-react'

type BatchUpdateQuantityModalProps = {
  isOpen: boolean
  onClose: () => void
  onUpdate: (adjustment: number) => void
  selectedProducts: Array<{
    productId: string
    name: string
    currentQuantity: number
  }>
}

const BatchUpdateQuantityModal = ({
  isOpen,
  onClose,
  onUpdate,
  selectedProducts,
}: BatchUpdateQuantityModalProps) => {
  const [adjustment, setAdjustment] = useState<number>(0)
  const [adjustmentInput, setAdjustmentInput] = useState<string>('0')

  useEffect(() => {
    if (isOpen) {
      setAdjustment(0)
      setAdjustmentInput('0')
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleAdjustment = (value: number) => {
    const newAdjustment = adjustment + value
    setAdjustment(newAdjustment)
    setAdjustmentInput(newAdjustment.toString())
  }

  const handleDirectInput = (value: string) => {
    if (value === '' || value === '-') {
      setAdjustmentInput(value)
      setAdjustment(0)
      return
    }

    const numValue = parseInt(value)
    if (isNaN(numValue)) return

    setAdjustment(numValue)
    setAdjustmentInput(value)
  }

  const handleSubmit = () => {
    const finalAdjustment =
      adjustmentInput === '' || adjustmentInput === '-' ? 0 : adjustment
    onUpdate(finalAdjustment)
    onClose()
  }

  const handleCancel = () => {
    setAdjustment(0)
    setAdjustmentInput('0')
    onClose()
  }

  const totalCurrentQuantity = selectedProducts.reduce(
    (sum, p) => sum + p.currentQuantity,
    0
  )

  const productsGoingNegative = selectedProducts.filter(
    (p) => p.currentQuantity + adjustment < 0
  )

  return (
    <div className='fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center'>
      <div className='relative bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto'>
        <div className='flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10'>
          <h3 className='text-xl font-bold text-gray-800'>
            Масове оновлення кількості
          </h3>
          <button
            onClick={handleCancel}
            className='text-gray-400 hover:text-gray-600 transition-colors'
          >
            <X className='w-6 h-6' />
          </button>
        </div>

        <div className='p-6'>
          <div className='mb-6 p-4 bg-blue-50 rounded-lg'>
            <p className='text-sm font-medium text-blue-900 mb-2'>
              Вибрано товарів:{' '}
              <span className='font-bold'>{selectedProducts.length}</span>
            </p>
            <p className='text-sm text-blue-700'>
              Загальна кількість:{' '}
              <span className='font-bold'>{totalCurrentQuantity} од.</span>
            </p>
          </div>

          {productsGoingNegative.length > 0 && (
            <div className='mb-6 p-4 bg-red-50 border border-red-200 rounded-lg'>
              <div className='flex items-start gap-2'>
                <AlertCircle className='w-5 h-5 text-red-600 flex-shrink-0 mt-0.5' />
                <div>
                  <p className='text-sm font-medium text-red-900 mb-1'>
                    Увага! {productsGoingNegative.length} товарів матимуть
                    від&apos;ємну кількість:
                  </p>
                  <div className='max-h-32 overflow-y-auto'>
                    {productsGoingNegative.slice(0, 5).map((p) => (
                      <p key={p.productId} className='text-xs text-red-700'>
                        • {p.name}: {p.currentQuantity} →{' '}
                        {p.currentQuantity + adjustment}
                      </p>
                    ))}
                    {productsGoingNegative.length > 5 && (
                      <p className='text-xs text-red-700 mt-1'>
                        ... та ще {productsGoingNegative.length - 5} товарів
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className='mb-6'>
            <p className='text-sm text-gray-600 font-medium mb-3'>
              Швидка зміна:
            </p>
            <div className='grid grid-cols-4 gap-3'>
              <button
                type='button'
                onClick={() => handleAdjustment(-10)}
                className='flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors'
              >
                <Minus className='w-4 h-4' />
                <span className='font-semibold'>10</span>
              </button>
              <button
                type='button'
                onClick={() => handleAdjustment(-5)}
                className='flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors'
              >
                <Minus className='w-4 h-4' />
                <span className='font-semibold'>5</span>
              </button>
              <button
                type='button'
                onClick={() => handleAdjustment(5)}
                className='flex items-center justify-center gap-2 px-4 py-3 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors'
              >
                <Plus className='w-4 h-4' />
                <span className='font-semibold'>5</span>
              </button>
              <button
                type='button'
                onClick={() => handleAdjustment(10)}
                className='flex items-center justify-center gap-2 px-4 py-3 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors'
              >
                <Plus className='w-4 h-4' />
                <span className='font-semibold'>10</span>
              </button>
            </div>
          </div>

          <div className='mb-6'>
            <label
              htmlFor='adjustment'
              className='block text-sm font-medium text-gray-700 mb-2'
            >
              Або введіть точну зміну (+ для збільшення, - для зменшення):
            </label>
            <input
              type='text'
              id='adjustment'
              value={adjustmentInput}
              onChange={(e) => handleDirectInput(e.target.value)}
              placeholder='0'
              className='w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-lg font-semibold text-center'
            />
          </div>

          {adjustment !== 0 && (
            <div className='mb-6 p-4 bg-blue-50 rounded-lg'>
              <p className='text-sm text-gray-600 mb-1'>
                Зміна для кожного товару:
              </p>
              <p
                className={`text-xl font-bold ${
                  adjustment > 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {adjustment > 0 ? '+' : ''}
                {adjustment} од.
              </p>
              <p className='text-sm text-gray-600 mt-2'>
                Нова загальна кількість:{' '}
                <span className='font-bold text-blue-600'>
                  {totalCurrentQuantity + adjustment * selectedProducts.length}{' '}
                  од.
                </span>
              </p>
            </div>
          )}

          <div className='mb-6'>
            <p className='text-sm font-medium text-gray-700 mb-3'>
              Попередній перегляд змін (перші 5 товарів):
            </p>
            <div className='max-h-48 overflow-y-auto border border-gray-200 rounded-lg'>
              {selectedProducts.slice(0, 5).map((product) => (
                <div
                  key={product.productId}
                  className='flex justify-between items-center p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50'
                >
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm font-medium text-gray-900 truncate'>
                      {product.name}
                    </p>
                    <p className='text-xs text-gray-500'>
                      ID: {product.productId}
                    </p>
                  </div>
                  <div className='text-right ml-4'>
                    <p className='text-sm'>
                      <span className='font-medium text-gray-700'>
                        {product.currentQuantity}
                      </span>
                      <span className='mx-2 text-gray-400'>→</span>
                      <span
                        className={`font-bold ${
                          product.currentQuantity + adjustment < 0
                            ? 'text-red-600'
                            : product.currentQuantity + adjustment === 0
                            ? 'text-yellow-600'
                            : 'text-green-600'
                        }`}
                      >
                        {product.currentQuantity + adjustment}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
              {selectedProducts.length > 5 && (
                <div className='p-3 text-center text-sm text-gray-500 bg-gray-50'>
                  ... та ще {selectedProducts.length - 5} товарів
                </div>
              )}
            </div>
          </div>

          <div className='flex gap-3'>
            <button
              type='button'
              onClick={handleCancel}
              className='flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium'
            >
              Скасувати
            </button>
            <button
              type='button'
              onClick={handleSubmit}
              disabled={adjustment === 0}
              className='flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed'
            >
              Застосувати до {selectedProducts.length} товарів
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BatchUpdateQuantityModal
