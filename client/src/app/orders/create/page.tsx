// client/src/app/orders/create/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  useCreateCRMOrderMutation,
  useGetProductsQuery,
  Product,
  CreateCRMOrderInput,
} from '@/state/api'
import {
  Plus,
  Trash2,
  Save,
  X,
  Search,
  ChevronDown,
  Loader2,
} from 'lucide-react'

interface OrderItem {
  productId?: string
  productName: string
  sku?: string
  quantity: number
  unitPrice: number
}

const CreateOrderPage = () => {
  const router = useRouter()
  const [createOrder, { isLoading }] = useCreateCRMOrderMutation()

  // Dropdown and search state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([])

  // Debounce logic
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch products from API
  const { data: productsData, isFetching } = useGetProductsQuery({
    search: debouncedSearch,
    page: currentPage,
    limit: 10,
  })

  const products = productsData?.products || []
  const totalPages = productsData?.pagination?.pages || 1

  // Reset to page 1 when searching
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch])

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
    clientNotes: '',
  })

  const [currentItem, setCurrentItem] = useState<OrderItem>({
    productId: '',
    productName: '',
    sku: '',
    quantity: 1,
    unitPrice: 0,
  })

  // Handlers
  const handleInputChange = (field: keyof CreateCRMOrderInput, value: any) => {
    //console.log('value is: ', value)

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
      productId: '',
      productName: '',
      sku: '',
      quantity: 1,
      unitPrice: 0,
    })
  }

  const handleCurrentItemChange = (field: keyof OrderItem, value: string) => {
    setCurrentItem((prev) => ({
      ...prev,
      [field]:
        field === 'quantity' || field === 'unitPrice'
          ? value === ''
            ? ''
            : Number(value) // Allow empty string in state
          : value,
    }))
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
console.log('Submitting order with data: ', formData);
      const result = await createOrder(formData).unwrap()
      alert(`Замовлення створено успішно! ID: ${result.orderId}`)
      router.push('/orders')
    } catch (error: any) {
      console.error('Failed to create order:', error)
      alert(
        `Помилка створення замовлення: ${
          error.data?.message || 'Невідома помилка'
        }`,
      )
    }
  }  

  //Logic for Checkboxes and Adding Multiple Items
  const toggleProductSelection = (product: Product) => {
    setSelectedProducts((prev) =>
      prev.find((p) => p.productId === product.productId)
        ? prev.filter((p) => p.productId !== product.productId)
        : [...prev, product],
    )
  }

  const addSelectedToOrder = () => {
    const newItems = selectedProducts.map((p) => ({
      productId: p.productId,
      productName: p.name,
      sku: p.sku,
      quantity: 1,
      unitPrice: p.price,
      totalPrice: p.price,
    }))

    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, ...newItems],
      totalAmount:
        prev.totalAmount +
        newItems.reduce((sum, item) => sum + item.totalPrice, 0),
    }))

    setSelectedProducts([]) // Clear selection
    setIsDropdownOpen(false) // Close dropdown
    setSearchTerm('') // Clear search
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
          {/* Product Search Selector */}
          <div className='bg-white rounded-lg shadow-sm p-6 mb-6 relative'>
            <div className='flex items-center justify-between mb-4'>
              <h2 className='text-xl font-semibold text-gray-900'>
                Вибір товару
              </h2>
            </div>

            <div className='relative'>
              <div
                className={`flex items-center border rounded-lg px-3 py-2.5 transition-all bg-gray-50/50 ${
                  isDropdownOpen
                    ? 'border-blue-500 ring-2 ring-blue-100 bg-white'
                    : 'border-gray-300'
                }`}
                /* onClick={() => setIsDropdownOpen(true)} */
              >
                {/* Search Icon Used Here */}
                <Search size={18} className='text-gray-400 mr-2' />

                <input
                  type='text'
                  className='w-full outline-none text-gray-700 bg-transparent placeholder:text-gray-400'
                  placeholder='Пошук товару за назвою або артикулом...'
                  value={searchTerm}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />

                <div
                  className='flex items-center border-l pl-2 ml-2 border-gray-200 cursor-pointer'
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)} // Toggle on chevron click
                >
                  {isFetching ? (
                    <Loader2 size={18} className='animate-spin text-blue-500' />
                  ) : (
                    <ChevronDown
                      size={18}
                      className={`text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                    />
                  )}
                </div>
              </div>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <>
                  <div
                    className='fixed inset-0 z-40'
                    onClick={() => setIsDropdownOpen(false)}
                  ></div>
                  <div className='absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-[600px] overflow-hidden flex flex-col'>
                    {/* Top Header for Multi-select */}
                    {selectedProducts.length > 0 && (
                      <div className='p-2 bg-blue-50 border-b flex justify-between items-center'>
                        <span className='text-sm font-medium text-blue-700 ml-2'>
                          Обрано: {selectedProducts.length}
                        </span>
                        <button
                          onClick={addSelectedToOrder}
                          className='bg-blue-600 text-white text-xs px-3 py-1.5 rounded hover:bg-blue-700 transition-colors'
                        >
                          Додати обрані
                        </button>
                      </div>
                    )}

                    <div className='overflow-y-auto flex-1'>
                      {products.length > 0 ? (
                        products.map((product, index) => {
                          const isChecked = selectedProducts.some(
                            (p) => p.productId === product.productId,
                          )
                          return (
                            <div
                              key={product.productId}
                              className={`flex items-start gap-3 p-3 border-b border-gray-100 last:border-0 transition-colors cursor-pointer ${isChecked ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
                              onClick={() => toggleProductSelection(product)}
                            >
                              {/* Checkbox */}
                              <div className='pt-1'>
                                <input
                                  type='checkbox'
                                  checked={isChecked}
                                  onChange={() => {}} // Handled by parent div onClick
                                  className='w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer'
                                />
                              </div>

                              <div className='relative w-12 h-12 flex-shrink-0'>
                                <Image
                                  src={
                                    product.mainImage ||
                                    '/placeholder-product.png'
                                  }
                                  alt={product.name}
                                  width={48}
                                  height={48}
                                  className='rounded object-cover border border-gray-100 bg-white'
                                  priority={index < 5}
                                />
                              </div>

                              <div className='flex-1 min-w-0'>
                                <p className='text-sm font-medium text-gray-900 truncate'>
                                  {product.name}
                                </p>
                                <div className='flex justify-between items-center mt-1'>
                                  <span className='text-xs text-gray-500 font-mono'>
                                    {product.sku}
                                  </span>
                                  <div className='text-right'>
                                    <span className='text-sm font-bold text-gray-900'>
                                      {product.price} грн
                                    </span>
                                    <p
                                      className={`text-[10px] font-medium ${product.stockQuantity > 0 ? 'text-green-600' : 'text-red-500'}`}
                                    >
                                      {product.stockQuantity > 0
                                        ? `Залишок: ${product.stockQuantity}`
                                        : 'Немає'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })
                      ) : !isFetching ? (
                        <div className='p-8 text-center text-gray-500 text-sm'>
                          Товарів не знайдено за запитом &quot;{searchTerm}
                          &quot;
                        </div>
                      ) : null}
                      {/* Loading Indicator inside list */}
                      {isFetching && (
                        <div className='p-8 text-center text-gray-400 text-sm flex items-center justify-center gap-2'>
                          <Loader2 size={16} className='animate-spin' />
                          Оновлення списку...
                        </div>
                      )}
                    </div>
                    {/* Pagination Footer */}
                    {totalPages > 1 && (
                      <div className='p-3 bg-gray-50 border-t flex justify-center items-center gap-1'>
                        {Array.from(
                          { length: totalPages },
                          (_, i) => i + 1,
                        ).map((pageNum) => (
                          <button
                            key={pageNum}
                            onClick={(e) => {
                              e.stopPropagation()
                              setCurrentPage(pageNum)
                            }}
                            className={`w-8 h-8 text-xs font-medium rounded border transition-colors ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                            }`}
                          >
                            {pageNum}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
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
                  <option value='PromPayment'>Пром оплата</option>
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
                      handleCurrentItemChange('productName', e.target.value)
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
                      handleCurrentItemChange('sku', e.target.value)
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
                      handleCurrentItemChange('quantity', e.target.value)
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
                      handleCurrentItemChange('unitPrice', e.target.value)
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
                      className='text-red-600 hover:text-red-800 p-2 cursor-pointer'
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
              value={formData.clientNotes}
              onChange={(e) => handleInputChange('clientNotes', e.target.value)}
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
                className='flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
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
