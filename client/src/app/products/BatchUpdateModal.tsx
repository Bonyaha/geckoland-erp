import React, { useState, useEffect } from 'react'
import { X, DollarSign, Box, Save,Settings } from 'lucide-react'

type UpdateMode = 'quantity' | 'price' | 'costPrice'

type BatchUpdateModalProps = {
  isOpen: boolean
  onClose: () => void
  onUpdate: (newValue: number, mode: UpdateMode) => void
  selectedProducts: Array<{
    productId: string
    name: string
    currentValue: number
  }>
  mode: UpdateMode
}

const BatchUpdateModal = ({
  isOpen,
  onClose,
  onUpdate,
  selectedProducts,
  mode,
}: BatchUpdateModalProps) => {
  const [newValue, setNewValue] = useState<string>('')

  // Reset input when modal opens
  useEffect(() => {
    if (isOpen) setNewValue('')
  }, [isOpen])

  if (!isOpen) return null

  const isPrice = mode === 'price' || mode === 'costPrice'
  const unit = isPrice ? 'грн' : 'од.'

  const getLabel = () => {
    if (mode === 'price') return 'ціну'
    if (mode === 'costPrice') return 'собівартість'
    return 'кількість'
  }
  const label = getLabel()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const numValue = isPrice ? parseFloat(newValue) : parseInt(newValue)

    if (!isNaN(numValue) && numValue >= 0) {
      onUpdate(numValue, mode)
    }
  }

  return (
    <div className='fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center'>
      <div className='relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4'>
        <div className='flex items-center justify-between p-6 border-b border-gray-200'>
          <h3 className='text-xl font-bold text-gray-800 flex items-center gap-2'>
            {mode === 'price' && (
              <DollarSign className='w-5 h-5 text-emerald-500' />
            )}
            {mode === 'costPrice' && (
              <Settings className='w-5 h-5 text-blue-500' />
            )}
            {mode === 'quantity' && <Box className='w-5 h-5 text-purple-500' />}
            Встановити нову {label}
          </h3>
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-gray-600'
          >
            <X className='w-6 h-6' />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='p-6'>
          <div className='mb-6 p-4 bg-blue-50 rounded-lg'>
            <p className='text-sm text-blue-800'>
              Ви міняєте {label} для <strong>{selectedProducts.length}</strong>{' '}
              товарів одночасно.
            </p>
          </div>

          <div className='mb-8'>
            <label className='block text-sm font-medium text-gray-700 mb-2 text-center'>
              Введіть нове значення ({unit}):
            </label>
            <input
              type='number'
              step={isPrice ? '0.01' : '1'}
              min='0'
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder='Наприклад: 50'
              className='w-full px-4 py-4 border-2 border-gray-300 rounded-xl focus:border-blue-500 text-3xl font-bold text-center outline-none transition-all'
              autoFocus
              required
            />
          </div>

          {/* Preview Section */}
          <div className='mb-6'>
            <p className='text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2'>
              Попередній перегляд:
            </p>
            <div className='bg-gray-50 rounded-lg border border-gray-200 divide-y divide-gray-200 max-h-40 overflow-y-auto'>
              {selectedProducts.map((p) => (
                <div
                  key={p.productId}
                  className='p-3 flex justify-between items-center'
                >
                  <span className='text-sm text-gray-600 truncate mr-4'>
                    {p.name}
                  </span>
                  <div className='flex items-center gap-2 shrink-0'>
                    <span className='text-xs text-gray-400 line-through'>
                      {p.currentValue}
                    </span>
                    <span className='text-sm font-bold text-blue-600'>
                      {newValue || '?'} {unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className='flex gap-3'>
            <button
              type='button'
              onClick={onClose}
              className='flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200'
            >
              Скасувати
            </button>
            <button
              type='submit'
              disabled={newValue === ''}
              className={`flex-1 py-3 text-white rounded-lg font-medium shadow-lg flex items-center justify-center gap-2 disabled:bg-gray-300 ${
                mode === 'price'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : mode === 'costPrice'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              <Save className='w-4 h-4' />
              Застосувати
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default BatchUpdateModal
