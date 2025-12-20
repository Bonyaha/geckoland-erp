import React, { useState } from 'react'
import { X, Calculator } from 'lucide-react'

type UpdateCostPriceModalProps = {
  isOpen: boolean
  onClose: () => void
  onUpdate: (newCost: number) => void
  productName: string
}

const UpdateCostPriceModal = ({
  isOpen,
  onClose,
  onUpdate,
  productName,
}: UpdateCostPriceModalProps) => {
  const [purchaseUsd, setPurchaseUsd] = useState<string>('')
  const [exchangeRate, setExchangeRate] = useState<string>('1') // Default rate example
  const [shippingUsd, setShippingUsd] = useState<string>('')
  const [otherUah, setOtherUah] = useState<string>('')

  if (!isOpen) return null

  // Calculation logic: (Purchase + Shipping) * Rate + Other
  const calculatedCost =
    ((parseFloat(purchaseUsd) || 0) + (parseFloat(shippingUsd) || 0)) *
      (parseFloat(exchangeRate) || 0) +
    (parseFloat(otherUah) || 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (calculatedCost > 0) {
      onUpdate(Number(calculatedCost.toFixed(2)))
      onClose()
    }
  }

  const inputStyle =
    'w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none'

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'>
      <div className='bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden'>
        <div className='p-4 border-b flex justify-between items-center bg-gray-50'>
          <h3 className='font-bold text-gray-700 flex items-center gap-2'>
            <Calculator className='w-5 h-5 text-blue-600' />
            Розрахунок собівартості
          </h3>
          <button onClick={onClose}>
            <X className='w-5 h-5 text-gray-400' />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='p-6 space-y-4'>
          <p className='text-sm text-gray-500 font-medium truncate'>
            {productName}
          </p>

          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='block text-xs font-semibold text-gray-600 mb-1'>
                Ціна закупівлі ($)
              </label>
              <input
                type='number'
                step='0.01'
                value={purchaseUsd}
                onChange={(e) => setPurchaseUsd(e.target.value)}
                className={inputStyle}
              />
            </div>
            <div>
              <label className='block text-xs font-semibold text-gray-600 mb-1'>
                Курс ($)
              </label>
              <input
                type='number'
                step='0.1'
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                className={inputStyle}
              />
            </div>
          </div>

          <div>
            <label className='block text-xs font-semibold text-gray-600 mb-1'>
              Доставка ($)
            </label>
            <input
              type='number'
              step='0.01'
              value={shippingUsd}
              onChange={(e) => setShippingUsd(e.target.value)}
              className={inputStyle}
            />
          </div>

          <div>
            <label className='block text-xs font-semibold text-gray-600 mb-1'>
              Інші витрати (грн)
            </label>
            <input
              type='number'
              step='1'
              value={otherUah}
              onChange={(e) => setOtherUah(e.target.value)}
              className={inputStyle}
            />
          </div>

          <div className='mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100 text-center'>
            <p className='text-sm text-blue-600 mb-1'>
              Підсумкова собівартість:
            </p>
            <p className='text-2xl font-bold text-blue-700'>
              {calculatedCost.toFixed(2)} грн.
            </p>
          </div>

          <div className='flex gap-3 pt-2'>
            <button
              type='button'
              onClick={onClose}
              className='flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200'
            >
              Скасувати
            </button>
            <button
              type='submit'
              className='flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-md'
            >
              Зберегти
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default UpdateCostPriceModal
