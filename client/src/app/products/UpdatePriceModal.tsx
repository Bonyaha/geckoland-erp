// client/src/app/products/UpdatePriceModal.tsx
import React, { useState, useEffect } from 'react'
import { X, Plus, Minus, Percent, DollarSign, RotateCcw } from 'lucide-react'

type UpdatePriceModalProps = {
  isOpen: boolean
  onClose: () => void
  onUpdate: (newPrice: number) => void
  currentPrice: number
  productName: string
}

type UpdateMode = 'absolute' | 'relative' | 'percent'

const UpdatePriceModal = ({
  isOpen,
  onClose,
  onUpdate,
  currentPrice,
  productName,
}: UpdatePriceModalProps) => {
  const [mode, setMode] = useState<UpdateMode>('relative')
  const [price, setPrice] = useState<string>(currentPrice.toString())
  const [adjustment, setAdjustment] = useState<number>(0)
  const [percentAdjustment, setPercentAdjustment] = useState<number>(0)

  useEffect(() => {
    if (isOpen) {
      setPrice(currentPrice.toFixed(2))
      setAdjustment(0)
      setPercentAdjustment(0)
      setMode('relative')
    }
  }, [isOpen, currentPrice])

  if (!isOpen) return null

  const handleRelativeAdjustment = (value: number) => {
    const newAdjustment = adjustment + value
    const newPrice = currentPrice + newAdjustment

    if (newPrice < 0) return

    setAdjustment(newAdjustment)
    setPrice(newPrice.toFixed(2))
    setPercentAdjustment(0)
  }

  const handlePercentAdjustment = (percent: number) => {
    const newPercentAdjustment = percentAdjustment + percent
    const multiplier = 1 + newPercentAdjustment / 100
    const newPrice = currentPrice * multiplier

    if (newPrice < 0) return

    setPercentAdjustment(newPercentAdjustment)
    setPrice(newPrice.toFixed(2))
    setAdjustment(0)
  }

  const handleDirectInput = (value: string) => {
    if (value === '') {
      setPrice('')
      setAdjustment(0)
      setPercentAdjustment(0)
      return
    }

    const numValue = parseFloat(value)
    if (isNaN(numValue) || numValue < 0) return

    setPrice(value)
    setAdjustment(0)
    setPercentAdjustment(0)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const finalPrice = price === '' ? 0 : parseFloat(price)
    if (!isNaN(finalPrice) && finalPrice >= 0) {
      onUpdate(finalPrice)
      onClose()
    }
  }
  const handleCancel = () => {
    setPrice(currentPrice.toFixed(2))
    setAdjustment(0)
    setPercentAdjustment(0)
    onClose()
  }

const handleReset = () => {
  setPrice(currentPrice.toFixed(2))
  setAdjustment(0)
  setPercentAdjustment(0)
}

  const priceChange = parseFloat(price || '0') - currentPrice
  const percentChange =
    currentPrice > 0 ? (priceChange / currentPrice) * 100 : 0

  return (
    <div className='fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center'>
      <div className='relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4'>
        {/* Header */}
        <div className='flex items-center justify-between p-6 border-b border-gray-200'>
          <h3 className='text-xl font-bold text-gray-800'>Оновити ціну</h3>
          <button
            onClick={handleCancel}
            className='text-gray-400 hover:text-gray-600 transition-colors cursor-pointer'
          >
            <X className='w-6 h-6' />
          </button>
        </div>

        {/* Content */}
        <div className='p-6'>
          {/* Product Name */}
          <div className='mb-4'>
            <p className='text-sm text-gray-600 font-medium mb-1'>Товар:</p>
            <p className='text-base text-gray-800 truncate'>{productName}</p>
          </div>

          {/* Current Price */}
          <div className='mb-6'>
            <p className='text-sm text-gray-600 font-medium mb-1'>
              Поточна ціна:
            </p>
            <p className='text-2xl font-bold text-green-600'>
              {currentPrice.toFixed(2)} грн.
            </p>
          </div>

          {/* Mode Selector */}
          <div className='mb-6'>
            <p className='text-sm text-gray-600 font-medium mb-3'>
              Спосіб зміни:
            </p>
            <div className='grid grid-cols-3 gap-2'>
              <button
                onClick={() => setMode('relative')}
                className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  mode === 'relative'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } cursor-pointer`}
              >
                <DollarSign className='w-4 h-4' />
                +/− Сума
              </button>
              <button
                onClick={() => setMode('percent')}
                className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  mode === 'percent'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } cursor-pointer`}
              >
                <Percent className='w-4 h-4' />
                +/− %
              </button>
              <button
                onClick={() => setMode('absolute')}
                className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  mode === 'absolute'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } cursor-pointer`}
              >
                Точна
              </button>
            </div>
          </div>

          {/* Adjustment Buttons - Relative (Amount) */}
          {mode === 'relative' && (
            <div className='mb-6'>
              <p className='text-sm text-gray-600 font-medium mb-3'>
                Швидка зміна (грн):
              </p>
              <div className='grid grid-cols-3 gap-2'>
                <button
                  onClick={() => handleRelativeAdjustment(-30)}
                  className='flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors cursor-pointer'
                >
                  <Minus className='w-4 h-4' />
                  <span className='font-semibold'>30</span>
                </button>
                <button
                  onClick={() => handleRelativeAdjustment(-10)}
                  className='flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors cursor-pointer'
                >
                  <Minus className='w-4 h-4' />
                  <span className='font-semibold'>10</span>
                </button>
                <button
                  onClick={() => handleRelativeAdjustment(-5)}
                  className='flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors cursor-pointer'
                >
                  <Minus className='w-4 h-4' />
                  <span className='font-semibold'>5</span>
                </button>
                <button
                  onClick={() => handleRelativeAdjustment(5)}
                  className='flex items-center justify-center gap-2 px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors cursor-pointer'
                >
                  <Plus className='w-4 h-4' />
                  <span className='font-semibold'>5</span>
                </button>
                <button
                  onClick={() => handleRelativeAdjustment(10)}
                  className='flex items-center justify-center gap-2 px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors cursor-pointer'
                >
                  <Plus className='w-4 h-4' />
                  <span className='font-semibold'>10</span>
                </button>
                <button
                  onClick={() => handleRelativeAdjustment(30)}
                  className='flex items-center justify-center gap-2 px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors cursor-pointer'
                >
                  <Plus className='w-4 h-4' />
                  <span className='font-semibold'>30</span>
                </button>
              </div>
            </div>
          )}

          {/* Adjustment Buttons - Percent */}
          {mode === 'percent' && (
            <div className='mb-6'>
              <p className='text-sm text-gray-600 font-medium mb-3'>
                Швидка зміна (%):
              </p>
              <div className='grid grid-cols-3 gap-2'>
                <button
                  onClick={() => handlePercentAdjustment(-20)}
                  className='flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors cursor-pointer'
                >
                  <Minus className='w-4 h-4' />
                  <span className='font-semibold'>20%</span>
                </button>
                <button
                  onClick={() => handlePercentAdjustment(-10)}
                  className='flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors cursor-pointer'
                >
                  <Minus className='w-4 h-4' />
                  <span className='font-semibold'>10%</span>
                </button>
                <button
                  onClick={() => handlePercentAdjustment(-5)}
                  className='flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors cursor-pointer'
                >
                  <Minus className='w-4 h-4' />
                  <span className='font-semibold'>5%</span>
                </button>
                <button
                  onClick={() => handlePercentAdjustment(5)}
                  className='flex items-center justify-center gap-2 px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors cursor-pointer'
                >
                  <Plus className='w-4 h-4' />
                  <span className='font-semibold'>5%</span>
                </button>
                <button
                  onClick={() => handlePercentAdjustment(10)}
                  className='flex items-center justify-center gap-2 px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors cursor-pointer'
                >
                  <Plus className='w-4 h-4' />
                  <span className='font-semibold'>10%</span>
                </button>
                <button
                  onClick={() => handlePercentAdjustment(20)}
                  className='flex items-center justify-center gap-2 px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors cursor-pointer'
                >
                  <Plus className='w-4 h-4' />
                  <span className='font-semibold'>20%</span>
                </button>
              </div>
            </div>
          )}

          {/* Direct Input */}
          <div className='mb-6'>
            <div className='flex justify-between items-end mb-2'>
              <label
                htmlFor='price'
                className='block text-sm font-medium text-gray-700'
              >
                {mode === 'absolute' ? 'Точна ціна (грн):' : 'Нова ціна (грн):'}
              </label>

              {/* Reset Button */}
              {parseFloat(price || '0') !== currentPrice && (
                <button
                  onClick={handleReset}
                  className='text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 cursor-pointer'
                >
                  <RotateCcw className='w-3 h-3' />
                  Скинути
                </button>
              )}
            </div>
            <input
              type='number'
              id='price'
              value={price}
              onChange={(e) => handleDirectInput(e.target.value)}
              step='0.01'
              min='0'
              className='w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-lg font-semibold text-center'
            />
          </div>

          {/* Change Summary */}
          {(adjustment !== 0 ||
            percentAdjustment !== 0 ||
            parseFloat(price || '0') !== currentPrice) && (
            <div className='mb-6 p-4 bg-blue-50 rounded-lg'>
              <p className='text-sm text-gray-600 mb-1'>Зміна:</p>
              <div className='flex items-center gap-3'>
                <p
                  className={`text-xl font-bold ${
                    priceChange > 0
                      ? 'text-green-600'
                      : priceChange < 0
                      ? 'text-red-600'
                      : 'text-gray-600'
                  }`}
                >
                  {priceChange > 0 ? '+' : ''}
                  {priceChange.toFixed(2)} грн.
                </p>
                <p
                  className={`text-sm font-bold ${
                    percentChange > 0
                      ? 'text-green-500'
                      : percentChange < 0
                      ? 'text-red-500'
                      : 'text-gray-500'
                  }`}
                >
                  ({percentChange > 0 ? '+' : ''}
                  {percentChange.toFixed(1)}%)
                </p>
              </div>
              <p className='text-sm text-gray-600 mt-2'>
                Нова ціна:{' '}
                <span className='font-bold text-blue-600'>
                  {price === '' ? '0.00' : parseFloat(price).toFixed(2)} грн.
                </span>
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className='flex gap-3'>
            <button
              onClick={handleCancel}
              className='flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium cursor-pointer'
            >
              Скасувати
            </button>
            <button
              onClick={handleSubmit}
              disabled={(price === '' ? 0 : parseFloat(price)) === currentPrice}
              className='flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed shadow-lg cursor-pointer'
            >
              Зберегти
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UpdatePriceModal
