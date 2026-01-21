// client/src/app/orders/create/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCreateCRMOrderMutation, CreateCRMOrderInput } from '@/state/api'
import { Plus, Trash2, Save, X } from 'lucide-react'

interface OrderItem {
  productName: string
  sku?: string
  quantity: number
  unitPrice: number
}

const CreateOrderPage = () => {
  const router = useRouter()
  const [createOrder, { isLoading }] = useCreateCRMOrderMutation()

  // Form state
  const [formData, setFormData] = useState<CreateCRMOrderInput>({
    clientFirstName: '',
    clientLastName: '',
    clientSecondName: '',
    clientPhone: '',
    clientEmail: '',
    deliveryAddress: '',
    deliveryCity: '',
    deliveryOptionName: '',
    paymentOptionName: '',
    items: [],
    totalAmount: 0,
    currency: 'UAH',
    notes: '',
  })

  const [currentItem, setCurrentItem] = useState<OrderItem>({
    productName: '',
    sku: '',
    quantity: 1,
    unitPrice: 0,
  })

  // Handlers
  const handleInputChange = (field: keyof CreateCRMOrderInput, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleAddItem = () => {
    if (!currentItem.productName || currentItem.unitPrice <= 0) {
      alert('Будь ласка, заповніть назву товару та ціну')
      return
    }

    const newItem = {
      ...currentItem,
      totalPrice: currentItem.quantity * currentItem.unitPrice,
    }

    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
      totalAmount: prev.totalAmount + newItem.totalPrice,
    }))

    // Reset current item
    setCurrentItem({
      productName: '',
      sku: '',
      quantity: 1,
      unitPrice: 0,
    })
  }

  const handleRemoveItem = (index: number) => {
    const removedItem = formData.items[index]
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
      totalAmount: prev.totalAmount - (removedItem.totalPrice || 0),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.items.length === 0) {
      alert('Додайте хоча б один товар до замовлення')
      return
    }

    if (!formData.clientPhone) {
      alert('Введіть номер телефону клієнта')
      return
    }

    try {
      const result = await createOrder(formData).unwrap()
      alert(`Замовлення створено успішно! ID: ${result.orderId}`)
      router.push('/orders')
    } catch (error: any) {
      console.error('Failed to create order:', error)
      alert(
        `Помилка створення замовлення: ${
          error.data?.message || 'Невідома помилка'
        }`
      )
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
    }).format(amount)
  }

  return (
    <div className='p-6 bg-gray-50 min-h-screen'>
      <div className='max-w-4xl mx-auto'>
        {/* Header */}
        <div className='mb-6'>
          <h1 className='text-3xl font-bold text-gray-900 mb-2'>
            Створити замовлення
          </h1>
          <p className='text-gray-600'>Ручне створення замовлення в CRM</p>
        </div>

        <form onSubmit={handleSubmit} className='space-y-6'>
          {/* Client Information */}
          <div className='bg-white rounded-lg shadow-sm p-6'>
            <h2 className='text-xl font-semibold text-gray-900 mb-4'>
              Інформація про клієнта
            </h2>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Прізвище <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  required
                  value={formData.clientLastName}
                  onChange={(e) =>
                    handleInputChange('clientLastName', e.target.value)
                  }
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'
                  placeholder='Іванов'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Ім&apos;я <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  required
                  value={formData.clientFirstName}
                  onChange={(e) =>
                    handleInputChange('clientFirstName', e.target.value)
                  }
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'
                  placeholder='Іван'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  По батькові
                </label>
                <input
                  type='text'
                  value={formData.clientSecondName}
                  onChange={(e) =>
                    handleInputChange('clientSecondName', e.target.value)
                  }
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'
                  placeholder='Іванович'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Телефон <span className='text-red-500'>*</span>
                </label>
                <input
                  type='tel'
                  required
                  value={formData.clientPhone}
                  onChange={(e) =>
                    handleInputChange('clientPhone', e.target.value)
                  }
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'
                  placeholder='+380501234567'
                />
              </div>
              <div className='md:col-span-2'>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Email
                </label>
                <input
                  type='email'
                  value={formData.clientEmail}
                  onChange={(e) =>
                    handleInputChange('clientEmail', e.target.value)
                  }
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'
                  placeholder='example@email.com'
                />
              </div>
            </div>
          </div>

          {/* Delivery Information */}
          <div className='bg-white rounded-lg shadow-sm p-6'>
            <h2 className='text-xl font-semibold text-gray-900 mb-4'>
              Доставка
            </h2>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Спосіб доставки
                </label>
                <select
                  value={formData.deliveryOptionName}
                  onChange={(e) =>
                    handleInputChange('deliveryOptionName', e.target.value)
                  }
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'
                >
                  <option value=''>Оберіть спосіб</option>
                  <option value='NovaPoshta'>Нова Пошта</option>
                  <option value='UkrPoshta'>Укрпошта</option>
                </select>
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Місто
                </label>
                <input
                  type='text'
                  value={formData.deliveryCity}
                  onChange={(e) =>
                    handleInputChange('deliveryCity', e.target.value)
                  }
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'
                  placeholder='Київ'
                />
              </div>
              <div className='md:col-span-2'>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Адреса
                </label>
                <input
                  type='text'
                  value={formData.deliveryAddress}
                  onChange={(e) =>
                    handleInputChange('deliveryAddress', e.target.value)
                  }
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'
                  placeholder='Відділення №1 або адреса доставки'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Спосіб оплати
                </label>
                <select
                  value={formData.paymentOptionName}
                  onChange={(e) =>
                    handleInputChange('paymentOptionName', e.target.value)
                  }
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'
                >
                  <option value=''>Оберіть спосіб</option>
                  <option value='CashOnDelivery'>Післяплата</option>
                  <option value='IBAN'>IBAN</option>
                  <option value='PromPayment'>Pром оплата</option>
                  <option value='RozetkaPay'>Rozetka Pay</option>
                </select>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className='bg-white rounded-lg shadow-sm p-6'>
            <h2 className='text-xl font-semibold text-gray-900 mb-4'>Товари</h2>

            {/* Add Item Form */}
            <div className='bg-gray-50 p-4 rounded-lg mb-4'>
              <div className='grid grid-cols-1 md:grid-cols-5 gap-3 items-end'>
                <div className='md:col-span-2'>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>
                    Назва товару <span className='text-red-500'>*</span>
                  </label>
                  <input
                    type='text'
                    value={currentItem.productName}
                    onChange={(e) =>
                      setCurrentItem({
                        ...currentItem,
                        productName: e.target.value,
                      })
                    }
                    className='w-full px-3 py-2 border border-gray-300 rounded-lg'
                    placeholder='Назва товару'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>
                    SKU
                  </label>
                  <input
                    type='text'
                    value={currentItem.sku}
                    onChange={(e) =>
                      setCurrentItem({ ...currentItem, sku: e.target.value })
                    }
                    className='w-full px-3 py-2 border border-gray-300 rounded-lg'
                    placeholder='SKU'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>
                    Кількість
                  </label>
                  <input
                    type='number'
                    min='1'
                    value={currentItem.quantity}
                    onChange={(e) =>
                      setCurrentItem({
                        ...currentItem,
                        quantity: Number(e.target.value),
                      })
                    }
                    className='w-full px-3 py-2 border border-gray-300 rounded-lg'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>
                    Ціна
                  </label>
                  <input
                    type='number'
                    min='0'
                    step='0.01'
                    value={currentItem.unitPrice}
                    onChange={(e) =>
                      setCurrentItem({
                        ...currentItem,
                        unitPrice: Number(e.target.value),
                      })
                    }
                    className='w-full px-3 py-2 border border-gray-300 rounded-lg'
                  />
                </div>
              </div>
              <button
                type='button'
                onClick={handleAddItem}
                className='mt-3 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'
              >
                <Plus size={18} />
                Додати товар
              </button>
            </div>

            {/* Items List */}
            {formData.items.length > 0 ? (
              <div className='space-y-2'>
                {formData.items.map((item, index) => (
                  <div
                    key={index}
                    className='flex justify-between items-center p-3 bg-gray-50 rounded-lg'
                  >
                    <div className='flex-1'>
                      <p className='font-medium text-gray-900'>
                        {item.productName}
                      </p>
                      <p className='text-sm text-gray-600'>
                        {item.sku && `SKU: ${item.sku} • `}
                        {item.quantity} × {formatCurrency(item.unitPrice)} ={' '}
                        {formatCurrency(item.totalPrice || 0)}
                      </p>
                    </div>
                    <button
                      type='button'
                      onClick={() => handleRemoveItem(index)}
                      className='text-red-600 hover:text-red-800 p-2'
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className='text-gray-500 text-center py-4'>Товари не додано</p>
            )}
          </div>

          {/* Notes */}
          <div className='bg-white rounded-lg shadow-sm p-6'>
            <h2 className='text-xl font-semibold text-gray-900 mb-4'>
              Примітки
            </h2>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={4}
              className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'
              placeholder='Додаткова інформація про замовлення...'
            />
          </div>

          {/* Total and Actions */}
          <div className='bg-white rounded-lg shadow-sm p-6'>
            <div className='flex justify-between items-center mb-4'>
              <span className='text-xl font-semibold text-gray-900'>
                Загальна сума:
              </span>
              <span className='text-2xl font-bold text-blue-600'>
                {formatCurrency(formData.totalAmount)}
              </span>
            </div>
            <div className='flex gap-3'>
              <button
                type='submit'
                disabled={isLoading || formData.items.length === 0}
                className='flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                <Save size={20} />
                {isLoading ? 'Створення...' : 'Створити замовлення'}
              </button>
              <button
                type='button'
                onClick={() => router.push('/orders')}
                className='px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50'
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateOrderPage
