// client/src/app/products/UpdateCostPriceModal.tsx
import React, { useState, useEffect } from 'react'
import {
  X,
  Calculator,
  Plus,
  Minus,
  Percent,
  DollarSign,
  RotateCcw,
  Save,
} from 'lucide-react'

type UpdateCostPriceModalProps = {
  isOpen: boolean
  onClose: () => void
  onUpdate: (newCost: number) => void
  productName: string
}

type CalculationMode = 'formula' | 'quick' | 'percent'

const UpdateCostPriceModal = ({
  isOpen,
  onClose,
  onUpdate,
  productName,
}: UpdateCostPriceModalProps) => {
  const [mode, setMode] = useState<CalculationMode>('formula')

  // Formula mode states
  const [purchaseUsd, setPurchaseUsd] = useState<string>('')
  const [exchangeRate, setExchangeRate] = useState<string>('1')
  const [shippingUsd, setShippingUsd] = useState<string>('')
  const [otherUah, setOtherUah] = useState<string>('')

  // Quick adjustment mode states
  const [quickCost, setQuickCost] = useState<string>('0')
  const [adjustment, setAdjustment] = useState<number>(0)
  const [percentAdjustment, setPercentAdjustment] = useState<number>(0)

  const initialCost = 0 // Since we don't have a current cost, start from 0

  useEffect(() => {
    if (isOpen) {
      // Reset all states when modal opens
      setPurchaseUsd('')
      setExchangeRate('1')
      setShippingUsd('')
      setOtherUah('')
      setQuickCost('0')
      setAdjustment(0)
      setPercentAdjustment(0)
      setMode('formula')
    }
  }, [isOpen])

  if (!isOpen) return null

  // Formula calculation: (Purchase + Shipping) * Rate + Other
  const calculatedFromFormula =
    ((parseFloat(purchaseUsd) || 0) + (parseFloat(shippingUsd) || 0)) *
      (parseFloat(exchangeRate) || 0) +
    (parseFloat(otherUah) || 0)

  // Quick adjustment handlers
  const handleQuickAdjustment = (value: number) => {
    const currentBase =
      mode === 'percent' ? initialCost : parseFloat(quickCost) || 0
    const newAdjustment = adjustment + value
    const newCost = currentBase + newAdjustment

    if (newCost < 0) return

    setAdjustment(newAdjustment)
    setQuickCost(newCost.toFixed(2))
    setPercentAdjustment(0)
  }

  const handlePercentAdjustment = (percent: number) => {
    const baseValue = parseFloat(quickCost) || initialCost
    const newPercentAdjustment = percentAdjustment + percent
    const multiplier = 1 + newPercentAdjustment / 100
    const newCost = baseValue * multiplier

    if (newCost < 0) return

    setPercentAdjustment(newPercentAdjustment)
    setQuickCost(newCost.toFixed(2))
    setAdjustment(0)
  }

  const handleDirectInput = (value: string) => {
    if (value === '') {
      setQuickCost('')
      setAdjustment(0)
      setPercentAdjustment(0)
      return
    }

    const numValue = parseFloat(value)
    if (isNaN(numValue) || numValue < 0) return

    setQuickCost(value)
    setAdjustment(0)
    setPercentAdjustment(0)
  }

  const handleReset = () => {
    setQuickCost('0')
    setAdjustment(0)
    setPercentAdjustment(0)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    let finalCost = 0

    if (mode === 'formula') {
      finalCost = calculatedFromFormula
    } else {
      finalCost = quickCost === '' ? 0 : parseFloat(quickCost)
    }

    if (finalCost > 0) {
      onUpdate(Number(finalCost.toFixed(2)))
      onClose()
    }
  }

  const inputStyle =
    'w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none'

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'>
      <div className='bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto'>
        <div className='p-4 border-b flex justify-between items-center bg-gray-50 sticky top-0 z-10'>
          <h3 className='font-bold text-gray-700 flex items-center gap-2'>
            <Calculator className='w-5 h-5 text-blue-600' />
            Розрахунок собівартості
          </h3>
          <button onClick={onClose} className='cursor-pointer'>
            <X className='w-5 h-5 text-gray-400' />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='p-6 space-y-4'>
          <p className='text-sm text-gray-500 font-medium truncate'>
            {productName}
          </p>

          {/* Mode Selector */}
          <div>
            <p className='text-sm text-gray-600 font-medium mb-3'>
              Спосіб розрахунку:
            </p>
            <div className='grid grid-cols-3 gap-2'>
              <button
                type='button'
                onClick={() => setMode('formula')}
                className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-medium text-sm transition-all cursor-pointer ${
                  mode === 'formula'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Calculator className='w-4 h-4' />
                Формула
              </button>
              <button
                type='button'
                onClick={() => setMode('quick')}
                className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-medium text-sm transition-all cursor-pointer ${
                  mode === 'quick'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <DollarSign className='w-4 h-4' />
                +/− Сума
              </button>
              <button
                type='button'
                onClick={() => setMode('percent')}
                className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-medium text-sm transition-all cursor-pointer ${
                  mode === 'percent'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Percent className='w-4 h-4' />
                +/− %
              </button>
            </div>
          </div>

          {/* Formula Mode */}
          {mode === 'formula' && (
            <>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-xs font-semibold text-gray-600 mb-1'>
                    Ціна закупівлі
                  </label>
                  <input
                    type='number'
                    step='1'
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
                  step='1'
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

              <div className='mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100 text-center'>
                <p className='text-sm text-blue-600 mb-1'>
                  Підсумкова собівартість:
                </p>
                <p className='text-2xl font-bold text-blue-700'>
                  {calculatedFromFormula.toFixed(2)} грн.
                </p>
              </div>
            </>
          )}

          {/* Quick Adjustment Mode */}
          {mode === 'quick' && (
            <>
              <div>
                <p className='text-sm text-gray-600 font-medium mb-3'>
                  Швидка зміна (грн):
                </p>
                <div className='grid grid-cols-3 gap-2'>
                  <button
                    type='button'
                    onClick={() => handleQuickAdjustment(-30)}
                    className='flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors cursor-pointer'
                  >
                    <Minus className='w-4 h-4' />
                    <span className='font-semibold'>30</span>
                  </button>
                  <button
                    type='button'
                    onClick={() => handleQuickAdjustment(-10)}
                    className='flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors cursor-pointer'
                  >
                    <Minus className='w-4 h-4' />
                    <span className='font-semibold'>10</span>
                  </button>
                  <button
                    type='button'
                    onClick={() => handleQuickAdjustment(-5)}
                    className='flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors cursor-pointer'
                  >
                    <Minus className='w-4 h-4' />
                    <span className='font-semibold'>5</span>
                  </button>
                  <button
                    type='button'
                    onClick={() => handleQuickAdjustment(5)}
                    className='flex items-center justify-center gap-2 px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors cursor-pointer'
                  >
                    <Plus className='w-4 h-4' />
                    <span className='font-semibold'>5</span>
                  </button>
                  <button
                    type='button'
                    onClick={() => handleQuickAdjustment(10)}
                    className='flex items-center justify-center gap-2 px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors cursor-pointer'
                  >
                    <Plus className='w-4 h-4' />
                    <span className='font-semibold'>10</span>
                  </button>
                  <button
                    type='button'
                    onClick={() => handleQuickAdjustment(30)}
                    className='flex items-center justify-center gap-2 px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors cursor-pointer'
                  >
                    <Plus className='w-4 h-4' />
                    <span className='font-semibold'>30</span>
                  </button>
                </div>
              </div>

              <div>
                <div className='flex justify-between items-end mb-2'>
                  <label className='block text-sm font-medium text-gray-700'>
                    Собівартість (грн):
                  </label>
                  {parseFloat(quickCost || '0') !== 0 && (
                    <button
                      type='button'
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
                  value={quickCost}
                  onChange={(e) => handleDirectInput(e.target.value)}
                  step='0.01'
                  min='0'
                  className='w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-lg font-semibold text-center'
                />
              </div>

              {adjustment !== 0 && (
                <div className='p-4 bg-blue-50 rounded-lg'>
                  <p className='text-sm text-gray-600 mb-1'>Зміна:</p>
                  <p
                    className={`text-xl font-bold ${
                      adjustment > 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {adjustment > 0 ? '+' : ''}
                    {adjustment.toFixed(2)} грн.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Percent Adjustment Mode */}
          {mode === 'percent' && (
            <>
              <div>
                <p className='text-sm text-gray-600 font-medium mb-3'>
                  Швидка зміна (%):
                </p>
                <div className='grid grid-cols-3 gap-2'>
                  <button
                    type='button'
                    onClick={() => handlePercentAdjustment(-20)}
                    className='flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors cursor-pointer'
                  >
                    <Minus className='w-4 h-4' />
                    <span className='font-semibold'>20%</span>
                  </button>
                  <button
                    type='button'
                    onClick={() => handlePercentAdjustment(-10)}
                    className='flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors cursor-pointer'
                  >
                    <Minus className='w-4 h-4' />
                    <span className='font-semibold'>10%</span>
                  </button>
                  <button
                    type='button'
                    onClick={() => handlePercentAdjustment(-5)}
                    className='flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors cursor-pointer'
                  >
                    <Minus className='w-4 h-4' />
                    <span className='font-semibold'>5%</span>
                  </button>
                  <button
                    type='button'
                    onClick={() => handlePercentAdjustment(5)}
                    className='flex items-center justify-center gap-2 px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors cursor-pointer'
                  >
                    <Plus className='w-4 h-4' />
                    <span className='font-semibold'>5%</span>
                  </button>
                  <button
                    type='button'
                    onClick={() => handlePercentAdjustment(10)}
                    className='flex items-center justify-center gap-2 px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors cursor-pointer'
                  >
                    <Plus className='w-4 h-4' />
                    <span className='font-semibold'>10%</span>
                  </button>
                  <button
                    type='button'
                    onClick={() => handlePercentAdjustment(20)}
                    className='flex items-center justify-center gap-2 px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors cursor-pointer'
                  >
                    <Plus className='w-4 h-4' />
                    <span className='font-semibold'>20%</span>
                  </button>
                </div>
              </div>

              <div>
                <div className='flex justify-between items-end mb-2'>
                  <label className='block text-sm font-medium text-gray-700'>
                    Собівартість (грн):
                  </label>
                  {parseFloat(quickCost || '0') !== 0 && (
                    <button
                      type='button'
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
                  value={quickCost}
                  onChange={(e) => handleDirectInput(e.target.value)}
                  step='0.01'
                  min='0'
                  className='w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-lg font-semibold text-center'
                />
              </div>

              {percentAdjustment !== 0 && (
                <div className='p-4 bg-blue-50 rounded-lg'>
                  <p className='text-sm text-gray-600 mb-1'>Зміна:</p>
                  <p
                    className={`text-xl font-bold ${
                      percentAdjustment > 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {percentAdjustment > 0 ? '+' : ''}
                    {percentAdjustment.toFixed(1)}%
                  </p>
                </div>
              )}
            </>
          )}

          {/* Action Buttons */}
          <div className='flex gap-3 pt-2'>
            <button
              type='button'
              onClick={onClose}
              className='flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 cursor-pointer'
            >
              Скасувати
            </button>
            <button
              type='submit'
              disabled={
                mode === 'formula'
                  ? calculatedFromFormula <= 0
                  : quickCost === '' || parseFloat(quickCost) <= 0
              }
              className='flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer'
            >
              <Save className='w-4 h-4' />
              Зберегти
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default UpdateCostPriceModal
