// client/src/app/products/BatchUpdateModal.tsx
import React, { useState, useEffect } from 'react'
import {
  X,
  DollarSign,
  Box,
  Save,  
  Percent,
  Plus,
  Minus,
  Calculator,
  RotateCcw,
} from 'lucide-react'

type UpdateMode = 'quantity' | 'price' | 'costPrice'
type CalculationMethod = 'absolute' | 'relative' | 'percent' | 'formula'

type BatchUpdateModalProps = {
  isOpen: boolean
  onClose: () => void
  // Updated signature to support relative/percent updates
  onUpdate: (value: number, mode: UpdateMode, method: CalculationMethod) => void
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
  // General State
  const [method, setMethod] = useState<CalculationMethod>('absolute')
  const [inputValue, setInputValue] = useState<string>('')

  // Cost Price Formula State
  const [purchaseUsd, setPurchaseUsd] = useState<string>('')
  const [exchangeRate, setExchangeRate] = useState<string>('1')
  const [shippingUsd, setShippingUsd] = useState<string>('')
  const [otherUah, setOtherUah] = useState<string>('')

  // Initialize defaults based on mode
  useEffect(() => {
    if (isOpen) {
      setInputValue('')
      setPurchaseUsd('')
      setExchangeRate('1')
      setShippingUsd('')
      setOtherUah('')

      // Set default methods to match single modals behavior
      if (mode === 'price') setMethod('relative')
      else if (mode === 'quantity') setMethod('relative')
      else if (mode === 'costPrice') setMethod('formula')
    }
  }, [isOpen, mode])

  if (!isOpen) return null

  // --- Helpers ---

  const getUnit = () => (mode === 'quantity' ? 'од.' : 'грн')

  const getTitle = () => {
    if (mode === 'price') return 'Оновити ціни'
    if (mode === 'quantity') return 'Змінити кількість'
    if (mode === 'costPrice') return 'Розрахунок собівартості'
    return ''
  }

  const getFormulaResult = () => {
    return (
      ((parseFloat(purchaseUsd) || 0) + (parseFloat(shippingUsd) || 0)) *
        (parseFloat(exchangeRate) || 0) +
      (parseFloat(otherUah) || 0)
    )
  }

  // Calculate the projected value for a specific product for the Preview list
  const calculatePreviewValue = (current: number) => {
    const val = parseFloat(inputValue) || 0

    if (method === 'absolute') return val

    if (method === 'relative') {
      const result = current + val
      return result < 0 ? 0 : result
    }

    if (method === 'percent') {
      const result = current * (1 + val / 100)
      return result < 0 ? 0 : result
    }

    if (method === 'formula') {
      return getFormulaResult()
    }

    return current
  }

  // --- Handlers ---

  const handleQuickAdjustment = (amount: number) => {
    const currentVal = parseFloat(inputValue) || 0
    setInputValue((currentVal + amount).toString())
  }

  const handleReset = () => {
    setInputValue('')
    setPurchaseUsd('')
    setExchangeRate('1')
    setShippingUsd('')
    setOtherUah('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    let finalValue = 0

    if (method === 'formula') {
      finalValue = getFormulaResult()
    } else {
      finalValue = parseFloat(inputValue)
    }

    // Validation
    if (isNaN(finalValue) && method !== 'formula' && inputValue === '') return

    // For absolute/formula, ensure non-negative
    if ((method === 'absolute' || method === 'formula') && finalValue < 0)
      return

    onUpdate(finalValue, mode, method)
    onClose()
  }

  // --- Renderers ---

  const renderModeSelector = () => {
    if (mode === 'quantity') return null // Quantity has different UI flow

    return (
      <div className='mb-6'>
        <p className='text-sm text-gray-600 font-medium mb-3'>Спосіб зміни:</p>
        <div className='grid grid-cols-3 gap-2'>
          {mode === 'costPrice' && (
            <button
              type='button'
              onClick={() => {
                setMethod('formula')
                setInputValue('')
              }}
              className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-medium text-sm transition-all cursor-pointer ${
                method === 'formula'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Calculator className='w-4 h-4' />
              Формула
            </button>
          )}

          <button
            type='button'
            onClick={() => {
              setMethod('relative')
              setInputValue('')
            }}
            className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-medium text-sm transition-all cursor-pointer ${
              method === 'relative'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <DollarSign className='w-4 h-4' />
            +/− Сума
          </button>

          <button
            type='button'
            onClick={() => {
              setMethod('percent')
              setInputValue('')
            }}
            className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-medium text-sm transition-all cursor-pointer ${
              method === 'percent'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Percent className='w-4 h-4' />
            +/− %
          </button>

          {(mode === 'price' || mode === 'costPrice') && (
            <button
              type='button'
              onClick={() => {
                setMethod('absolute')
                setInputValue('')
              }}
              className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-medium text-sm transition-all cursor-pointer ${
                method === 'absolute'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {mode === 'costPrice' && method !== 'absolute' ? (
                <DollarSign className='w-4 h-4' />
              ) : null}
              {mode === 'costPrice' ? 'Точна сума' : 'Точна ціна'}
            </button>
          )}
        </div>
      </div>
    )
  }

  const renderFormulaInputs = () => {
    const inputStyle =
      'w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none'
    return (
      <div className='space-y-3 mb-6'>
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

        <div className='p-3 bg-blue-50 rounded-lg text-center'>
          <span className='text-sm text-gray-600'>Результат для всіх: </span>
          <span className='font-bold text-blue-700 text-lg'>
            {getFormulaResult().toFixed(2)} грн
          </span>
        </div>
      </div>
    )
  }

  const renderQuickButtons = () => {
    if (method === 'absolute' || method === 'formula') return null

    const isPercent = method === 'percent'
    const suffix = isPercent ? '%' : ''

    // Values for buttons
    let buttons = []
    if (mode === 'quantity') {
      buttons = [-10, -1, 1, 10]
    } else {
      // Price / Cost
      buttons = isPercent
        ? [-20, -10, -5, 5, 10, 20]
        : [-30, -10, -5, 5, 10, 30]
    }

    return (
      <div className='mb-6'>
        <p className='text-sm text-gray-600 font-medium mb-3'>
          Швидка зміна ({isPercent ? '%' : mode === 'quantity' ? 'од.' : 'грн'}
          ):
        </p>
        <div
          className={`grid ${
            buttons.length === 4 ? 'grid-cols-4' : 'grid-cols-3'
          } gap-2`}
        >
          {buttons.map((val) => (
            <button
              key={val}
              type='button'
              onClick={() => handleQuickAdjustment(val)}
              className={`flex items-center justify-center gap-1 px-2 py-2 rounded-lg transition-colors cursor-pointer ${
                val < 0
                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                  : 'bg-green-50 text-green-600 hover:bg-green-100'
              }`}
            >
              {val < 0 ? (
                <Minus className='w-3 h-3' />
              ) : (
                <Plus className='w-3 h-3' />
              )}
              <span className='font-semibold text-sm'>
                {Math.abs(val)}
                {suffix}
              </span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className='fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center'>
      <div className='relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto'>
        {/* Header */}
        <div className='flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10'>
          <h3 className='text-xl font-bold text-gray-800 flex items-center gap-2'>
            {mode === 'price' && (
              <DollarSign className='w-6 h-6 text-green-600' />
            )}
            {mode === 'costPrice' && (
              <Calculator className='w-6 h-6 text-blue-600' />
            )}
            {mode === 'quantity' && <Box className='w-6 h-6 text-purple-600' />}
            {getTitle()}
          </h3>
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-gray-600 cursor-pointer'
          >
            <X className='w-6 h-6' />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='p-6'>
          {/* Quantity specific Mode Toggle */}
          {mode === 'quantity' && (
            <div className='flex bg-gray-100 p-1 rounded-lg mb-6'>
              <button
                type='button'
                onClick={() => {
                  setMethod('relative')
                  setInputValue('')
                }}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                  method === 'relative'
                    ? 'bg-white shadow text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                } cursor-pointer`}
              >
                + / - Додати/Відняти
              </button>
              <button
                type='button'
                onClick={() => {
                  setMethod('absolute')
                  setInputValue('')
                }}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                  method === 'absolute'
                    ? 'bg-white shadow text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                } cursor-pointer`}
              >
                = Встановити точно
              </button>
            </div>
          )}

          {/* Price/Cost Mode Selector */}
          {renderModeSelector()}

          {/* Formula Inputs (Cost Only) */}
          {method === 'formula' && renderFormulaInputs()}

          {/* Quick Adjustment Buttons (Not for Formula) */}
          {method !== 'formula' && renderQuickButtons()}

          {/* Main Input Field (Not for Formula) */}
          {method !== 'formula' && (
            <div className='mb-6'>
              <div className='flex justify-between items-end mb-2'>
                <label className='block text-sm font-medium text-gray-700'>
                  {method === 'absolute'
                    ? `Нова ${mode === 'quantity' ? 'кількість' : 'ціна'}:`
                    : 'Значення зміни:'}
                </label>
                {inputValue !== '' && (
                  <button
                    type='button'
                    onClick={handleReset}
                    className='text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer'
                  >
                    <RotateCcw className='w-3 h-3' />
                    Скинути
                  </button>
                )}
              </div>
              <input
                type='number'
                step={mode === 'quantity' ? '1' : '0.01'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={method === 'percent' ? 'Наприклад: 10' : '0'}
                className='w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-lg font-semibold text-center'
                autoFocus
              />
              {method === 'percent' && (
                <p className='text-xs text-center text-gray-500 mt-1'>
                  Введіть відсоток (напр. 10 для +10%, -20 для -20%)
                </p>
              )}
            </div>
          )}

          {/* Batch Summary */}
          <div className='mb-6 p-4 bg-gray-50 rounded-lg border border-gray-100'>
            <p className='text-sm text-gray-600 mb-2'>
              Вибрано товарів: <strong>{selectedProducts.length}</strong>
            </p>

            {/* Preview List */}
            <div className='mt-3'>
              <p className='text-xs font-bold text-gray-400 uppercase tracking-wider mb-2'>
                Попередній перегляд (перші 5):
              </p>
              <div className='space-y-2 max-h-40 overflow-y-auto'>
                {selectedProducts.slice(0, 5).map((p) => {
                  const oldVal = p.currentValue
                  const newVal = calculatePreviewValue(oldVal)
                  const diff = newVal - oldVal

                  return (
                    <div
                      key={p.productId}
                      className='flex justify-between items-center text-sm p-2 bg-white rounded border border-gray-100'
                    >
                      <span className='truncate flex-1 pr-2'>{p.name}</span>
                      <div className='flex items-center gap-3'>
                        <span className='text-gray-400 line-through text-xs'>
                          {oldVal.toFixed(mode === 'quantity' ? 0 : 2)}
                        </span>
                        <span className='text-gray-300'>→</span>
                        <span
                          className={`font-bold ${
                            diff > 0
                              ? 'text-green-600'
                              : diff < 0
                              ? 'text-red-600'
                              : 'text-blue-600'
                          }`}
                        >
                          {newVal.toFixed(mode === 'quantity' ? 0 : 2)}{' '}
                          {getUnit()}
                        </span>
                      </div>
                    </div>
                  )
                })}
                {selectedProducts.length > 5 && (
                  <p className='text-xs text-center text-gray-400 pt-1'>
                    ...і ще {selectedProducts.length - 5}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className='flex gap-3'>
            <button
              type='button'
              onClick={onClose}
              className='flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium cursor-pointer'
            >
              Скасувати
            </button>
            <button
              type='submit'
              disabled={method !== 'formula' && inputValue === ''}
              className={`flex-1 px-6 py-3 text-white rounded-lg transition-colors font-medium shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed ${
                mode === 'price'
                  ? 'bg-green-600 hover:bg-green-700'
                  : mode === 'quantity'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
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

export default BatchUpdateModal
