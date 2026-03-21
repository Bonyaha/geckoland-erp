// client/src/app/orders/(components)/AddAddressModal.tsx

'use client'

import { useState } from 'react'
import { X, Save, MapPin } from 'lucide-react'
import { useCreateClientAddressMutation } from '@/state/api'
import { useToast } from '@/hooks/useToast'

interface AddAddressModalProps {
  clientId: string
  clientName: string
  onClose: () => void
  onSuccess: (address: {
    addressId: string
    address: string
    deliveryOptionName?: string | null
  }) => void
}

const DELIVERY_OPTIONS = [
  { value: '', label: 'Оберіть спосіб' },
  { value: 'NovaPoshta', label: 'Нова Пошта' },
  { value: 'UkrPoshta', label: 'Укрпошта' },
]

export default function AddAddressModal({
  clientId,
  clientName,
  onClose,
  onSuccess,
}: AddAddressModalProps) {
  const [createAddress, { isLoading }] = useCreateClientAddressMutation()
  const { showToast } = useToast()

  const [formData, setFormData] = useState({
    address: '',
    branchNumber: '',
    deliveryOptionName: '',
    isPrimary: false,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.address.trim()) {
      showToast('Введіть адресу доставки', 'error')
      return
    }

    try {
      const result = await createAddress({
        clientId,
        address: formData.address.trim(),
        branchNumber: formData.branchNumber.trim() || undefined,
        deliveryOptionName: formData.deliveryOptionName || undefined,
        isPrimary: formData.isPrimary,
      }).unwrap()

      showToast('Адресу додано успішно!', 'success')
      onSuccess(result.data)
      onClose()
    } catch (error: any) {
      showToast(
        `Помилка: ${error?.data?.message || 'Не вдалося додати адресу'}`,
        'error',
      )
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className='fixed inset-0 bg-black/50 z-[250] flex items-center justify-center p-4'
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className='bg-white rounded-xl w-full max-w-lg shadow-2xl'
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className='flex items-center justify-between px-6 py-4 border-b border-gray-200'>
            <div className='flex items-center gap-3'>
              <div className='p-2 bg-blue-50 rounded-lg'>
                <MapPin size={20} className='text-blue-600' />
              </div>
              <div>
                <h2 className='text-lg font-bold text-gray-900'>
                  Додати адресу доставки
                </h2>
                <p className='text-sm text-gray-500'>{clientName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className='p-2 hover:bg-gray-100 rounded-full transition-colors'
            >
              <X size={20} className='text-gray-500' />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className='p-6 space-y-4'>
            {/* Address Field */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                Адреса доставки <span className='text-red-500'>*</span>
              </label>
              <input
                type='text'
                required
                value={formData.address}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, address: e.target.value }))
                }
                placeholder='Київ, вул. Васильківська, 55 (м. Виставковий Центр)'
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm'
              />
            </div>

            {/* Branch Number Field */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                Номер відділення
              </label>
              <input
                type='text'
                value={formData.branchNumber}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    branchNumber: e.target.value,
                  }))
                }
                placeholder='№64 або №59995 (Поштомат)'
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm'
              />
            </div>

            {/* Delivery Service Field */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                Служба доставки
              </label>
              <select
                value={formData.deliveryOptionName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    deliveryOptionName: e.target.value,
                  }))
                }
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm'
              >
                {DELIVERY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Primary Checkbox */}
            <div className='flex items-center gap-2'>
              <input
                type='checkbox'
                id='isPrimary'
                checked={formData.isPrimary}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    isPrimary: e.target.checked,
                  }))
                }
                className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
              />
              <label
                htmlFor='isPrimary'
                className='text-sm text-gray-700 cursor-pointer'
              >
                Зробити основною адресою
              </label>
            </div>

            {/* Action Buttons */}
            <div className='flex gap-3 pt-4'>
              <button
                type='submit'
                disabled={isLoading}
                className='flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
              >
                <Save size={18} />
                {isLoading ? 'Збереження...' : 'Додати адресу'}
              </button>
              <button
                type='button'
                onClick={onClose}
                className='px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer'
              >
                Скасувати
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
