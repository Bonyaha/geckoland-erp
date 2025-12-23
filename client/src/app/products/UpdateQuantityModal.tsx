// client/src/app/products/UpdateQuantityModal.tsx
import React, { useState, useEffect } from 'react'
import { X, Plus, Minus } from 'lucide-react'

type UpdateQuantityModalProps = {
  isOpen: boolean
  onClose: () => void
  onUpdate: (newQuantity: number) => void
  currentQuantity: number
  productName: string
}

const UpdateQuantityModal = ({
  isOpen,
  onClose,
  onUpdate,
  currentQuantity,
  productName,
}: UpdateQuantityModalProps) => {
  // Change 1: Allow state to be number OR empty string
  const [quantity, setQuantity] = useState<number | string>(currentQuantity)
  const [adjustment, setAdjustment] = useState<number>(0)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuantity(currentQuantity)
      setAdjustment(0)
    }
  }, [isOpen, currentQuantity])

  if (!isOpen) return null

  const handleAdjustment = (value: number) => {
    const newAdjustment = adjustment + value
    const newQuantity = currentQuantity + newAdjustment

    // Don't allow negative quantities
    if (newQuantity < 0) return

    setAdjustment(newAdjustment)
    setQuantity(newQuantity)
  }

  const handleDirectInput = (value: string) => {
    // Change 2: specific handling for empty string to allow clearing the input
    if (value === '') {
      setQuantity('')
      setAdjustment(0 - currentQuantity) // Treat empty as 0 for calculation purposes
      return
    }

    const numValue = parseInt(value)

    // Check if it's a valid number and not negative
    if (isNaN(numValue) || numValue < 0) return

    setQuantity(numValue)
    setAdjustment(numValue - currentQuantity)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Change 3: Ensure we send a number, default to 0 if string is empty
    const finalQuantity = quantity === '' ? 0 : Number(quantity)
    onUpdate(finalQuantity)
    onClose()
  }

  const handleCancel = () => {
    setQuantity(currentQuantity)
    setAdjustment(0)
    onClose()
  }

  return (
    <div className='fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center'>
      <div className='relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4'>
        {/* Header */}
        <div className='flex items-center justify-between p-6 border-b border-gray-200'>
          <h3 className='text-xl font-bold text-gray-800'>
            Змінити кількість товару
          </h3>
          <button
            onClick={handleCancel}
            className='text-gray-400 hover:text-gray-600 transition-colors cursor-pointer'
          >
            <X className='w-6 h-6' />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className='p-6'>
          {/* Product Name */}
          <div className='mb-4'>
            <p className='text-sm text-gray-600 font-medium mb-1'>Товар:</p>
            <p className='text-base text-gray-800 truncate'>{productName}</p>
          </div>

          {/* Current Quantity */}
          <div className='mb-6'>
            <p className='text-sm text-gray-600 font-medium mb-1'>
              Поточна кількість:
            </p>
            <p className='text-2xl font-bold text-blue-600'>
              {currentQuantity} од.
            </p>
          </div>

          {/* Adjustment Buttons */}
          <div className='mb-6'>
            <p className='text-sm text-gray-600 font-medium mb-3'>
              Швидка зміна:
            </p>
            <div className='grid grid-cols-2 gap-3'>
              <button
                type='button'
                onClick={() => handleAdjustment(-10)}
                className='flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors'
              >
                <Minus className='w-4 h-4' />
                <span className='font-semibold'>-10</span>
              </button>
              <button
                type='button'
                onClick={() => handleAdjustment(-1)}
                className='flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors'
              >
                <Minus className='w-4 h-4' />
                <span className='font-semibold'>-1</span>
              </button>
              <button
                type='button'
                onClick={() => handleAdjustment(1)}
                className='flex items-center justify-center gap-2 px-4 py-3 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors'
              >
                <Plus className='w-4 h-4' />
                <span className='font-semibold'>+1</span>
              </button>
              <button
                type='button'
                onClick={() => handleAdjustment(10)}
                className='flex items-center justify-center gap-2 px-4 py-3 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors'
              >
                <Plus className='w-4 h-4' />
                <span className='font-semibold'>+10</span>
              </button>
            </div>
          </div>

          {/* Direct Input */}
          <div className='mb-6'>
            <label
              htmlFor='quantity'
              className='block text-sm font-medium text-gray-700 mb-2'
            >
              Або введіть точну кількість:
            </label>
            <input
              type='number'
              id='quantity'
              value={quantity}
              onChange={(e) => handleDirectInput(e.target.value)}
              min='0'
              className='w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-lg font-semibold text-center'
            />
          </div>

          {/* Change Summary */}
          {adjustment !== 0 && (
            <div className='mb-6 p-4 bg-blue-50 rounded-lg'>
              <p className='text-sm text-gray-600 mb-1'>Зміна:</p>
              <p
                className={`text-xl font-bold ${
                  adjustment > 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {adjustment > 0 ? '+' : ''}
                {adjustment} од.
              </p>
              <p className='text-sm text-gray-600 mt-2'>
                Нова кількість:{' '}
                <span className='font-bold text-blue-600'>
                  {/* Handle display if quantity is empty string */}
                  {quantity === '' ? 0 : quantity} од.
                </span>
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className='flex gap-3'>
            <button
              type='button'
              onClick={handleCancel}
              className='flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium cursor-pointer'
            >
              Скасувати
            </button>
            <button
              type='submit'
              // Disable if quantity hasn't changed (safely handle empty string comparison)
              disabled={
                (quantity === '' ? 0 : Number(quantity)) === currentQuantity
              }
              className='flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer'
            >
              Зберегти
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default UpdateQuantityModal
