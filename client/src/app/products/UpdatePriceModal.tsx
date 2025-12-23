// client/src/app/products/UpdatePriceModal.tsx
import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'

type UpdatePriceModalProps = {
  isOpen: boolean
  onClose: () => void
  onUpdate: (newPrice: number) => void
  currentPrice: number
  productName: string
}

const UpdatePriceModal = ({
  isOpen,
  onClose,
  onUpdate,
  currentPrice,
  productName,
}: UpdatePriceModalProps) => {
  const [price, setPrice] = useState<string>(currentPrice.toString())

  useEffect(() => {
    if (isOpen) setPrice(currentPrice.toString())
  }, [isOpen, currentPrice])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const numPrice = parseFloat(price)
    if (!isNaN(numPrice) && numPrice >= 0) {
      onUpdate(numPrice)
      onClose()
    }
  }

  return (
    <div className='fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center'>
      <div className='relative bg-white rounded-xl shadow-2xl p-8 w-full max-w-md m-4'>
        <div className='flex justify-between items-center mb-6'>
          <h3 className='text-xl font-bold text-gray-800'>Оновити ціну</h3>
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-gray-600'
          >
            <X className='w-6 h-6' />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='space-y-6'>
          <div>
            <p className='text-sm text-gray-500 mb-1'>Товар:</p>
            <p className='font-medium text-gray-800'>{productName}</p>
          </div>

          <div className='bg-blue-50 p-4 rounded-lg border border-blue-100 text-center'>
            <label className='block text-sm text-blue-600 mb-2 font-medium'>
              Нова ціна (грн.)
            </label>
            <input
              type='number'
              step='0.01'
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className='w-full text-3xl font-bold text-center bg-transparent border-b-2 border-blue-300 focus:border-blue-500 outline-none text-blue-700'
              autoFocus
            />
          </div>

          <div className='flex gap-3'>
            <button
              type='button'
              onClick={onClose}
              className='flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium cursor-pointer'
            >
              Скасувати
            </button>
            <button
              type='submit'
              className='flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-lg cursor-pointer'
            >
              Зберегти
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default UpdatePriceModal
