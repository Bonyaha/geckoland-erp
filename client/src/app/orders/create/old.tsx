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
  /* Plus, */
  Trash2,
  Save,
  X,
  Search,
  ChevronDown,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CircleMinus,
  CirclePlus,
} from 'lucide-react'

/* interface OrderItem {
  productId?: string
  productName: string
  sku?: string
  quantity: number
  unitPrice: number
} */

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

  /* const [currentItem, setCurrentItem] = useState<OrderItem>({
    productId: '',
    productName: '',
    sku: '',
    quantity: 1,
    unitPrice: 0,
  })
 */
  // Recalculate total amount whenever items change
  useEffect(() => {
    const total = formData.items.reduce(
      (sum, item) => sum + (item.totalPrice || 0),
      0,
    )
    setFormData((prev) => ({ ...prev, totalAmount: total }))
  }, [formData.items])

  // Handlers
  const handleInputChange = (field: keyof CreateCRMOrderInput, value: any) => {
    //console.log('value is: ', value)

    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  /* const handleAddItem = () => {
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
  } */

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
      console.log('Submitting order with data: ', formData)
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

  // Directly add product from dropdown to the list
  /* const addProductToOrder = (product: Product) => {
    const exists = formData.items.find(
      (item) => item.productId === product.productId,
    )
    if (exists) {
      updateItemQuantity(product.productId!, exists.quantity + 1)
    } else {
      const newItem = {
        productId: product.productId,
        productName: product.name,
        sku: product.sku,
        quantity: 1,
        unitPrice: product.price,
        totalPrice: product.price,
      }
      setFormData((prev) => ({ ...prev, items: [...prev.items, newItem] }))
    }
    setIsDropdownOpen(false)
    setSearchTerm('')
  } */

  const updateItemQuantity = (productId: string, newQty: number) => {
    const qty = Math.max(1, newQty)
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.productId === productId
          ? { ...item, quantity: qty, totalPrice: qty * item.unitPrice }
          : item,
      ),
    }))
  }

  const updateItemPrice = (productId: string, newPrice: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.productId === productId
          ? {
              ...item,
              unitPrice: newPrice,
              totalPrice: item.quantity * newPrice,
            }
          : item,
      ),
    }))
  }

  const removeItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }))
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
        </div>

        <form onSubmit={handleSubmit} className='space-y-6'>
          {/* Main Product Selection Area */}
          <div className='bg-white rounded-lg shadow-sm p-6'>
            <div className='relative mb-4'>
              <div
                className={`flex items-center border rounded-lg px-3 py-2.5 transition-all ${isDropdownOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300'}`}
              >
                <Search size={18} className='text-gray-400 mr-2' />
                <input
                  type='text'
                  className='w-full outline-none text-gray-700 bg-transparent'
                  placeholder='Товар/артикул/бренд'
                  value={searchTerm}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {isFetching ? (
                  <Loader2
                    size={18}
                    className='text-blue-500 animate-spin mr-2'
                  />
                ) : (
                  <ChevronDown
                    size={18}
                    className='text-gray-400 cursor-pointer'
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  />
                )}
              </div>

              {/* Search Dropdown */}
              {isDropdownOpen && (
                <>
                  <div
                    className='fixed inset-0 z-40'
                    onClick={() => setIsDropdownOpen(false)}
                  ></div>
                  <div className='absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-hidden flex flex-col'>
                    {/* Top Header for Multi-select - inside the dropdown menu div */}
                    {selectedProducts.length > 0 && (
                      <div className='p-2 bg-blue-50 border-b flex justify-between items-center'>
                        <span className='text-sm font-medium text-blue-700 ml-2'>
                          Обрано: {selectedProducts.length}
                        </span>
                        <button
                          type='button'
                          onClick={addSelectedToOrder}
                          className='bg-blue-600 text-white text-xs px-3 py-1.5 rounded hover:bg-blue-700 transition-colors'
                        >
                          Додати обрані
                        </button>
                      </div>
                    )}
                    <div className='overflow-y-auto flex-1'>
                      {products.length > 0 ? (
                        products.map((product) => {
                          // Check if this specific product is currently selected
                          const isChecked = selectedProducts.some(
                            (p) => p.productId === product.productId,
                          )

                          return (
                            <div
                              key={product.productId}
                              className={`flex items-start gap-3 p-3 border-b border-gray-100 last:border-0 transition-colors cursor-pointer ${isChecked ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
                              onClick={() => toggleProductSelection(product)}
                            >
                              {/* Checkbox UI */}
                              <div className='pt-1'>
                                <input
                                  type='checkbox'
                                  checked={isChecked}
                                  onChange={() => {}} // Handled by parent div onClick
                                  className='w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer'
                                />
                              </div>
                              <Image
                                src={
                                  product.mainImage ||
                                  '/placeholder-product.png'
                                }
                                alt=''
                                width={40}
                                height={40}
                                className='rounded object-cover'
                              />
                              <div className='flex-1'>
                                <p className='text-sm font-medium'>
                                  {product.name}
                                </p>
                                <p className='text-xs text-gray-500'>
                                  {product.sku} • {product.price} грн
                                </p>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className='p-4 text-center text-gray-500'>
                          Товарів не знайдено
                        </div>
                      )}
                    </div>

                    {/* Dropdown Pagination Footer */}
                    {totalPages > 1 && (
                      <div className='p-2 border-t bg-gray-50 flex items-center justify-between'>
                        <button
                          type='button'
                          disabled={currentPage === 1}
                          onClick={() =>
                            setCurrentPage((p) => Math.max(1, p - 1))
                          }
                          className='p-1 disabled:opacity-30'
                        >
                          <ChevronLeft size={20} />
                        </button>
                        <span className='text-xs font-medium text-gray-600'>
                          Сторінка {currentPage} з {totalPages}
                        </span>
                        <button
                          type='button'
                          disabled={currentPage === totalPages}
                          onClick={() =>
                            setCurrentPage((p) => Math.min(totalPages, p + 1))
                          }
                          className='p-1 disabled:opacity-30'
                        >
                          <ChevronRight size={20} />
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Added Products List */}
            <div className='space-y-2'>
              {formData.items.map((item, index) => (
                <div
                  key={item.productId}
                  className='flex flex-wrap md:flex-nowrap items-center gap-4 p-3 border border-gray-200 rounded-lg bg-white shadow-sm'
                >
                  {/* Name and Stock Info */}
                  <div className='flex-1 min-w-[250px]'>
                    <p className='text-sm font-medium text-blue-600 leading-tight'>
                      {item.productName}
                      <span className='text-gray-400 ml-1 font-normal text-xs'>
                        {item.sku}
                      </span>
                    </p>
                    <p className='text-[11px] text-gray-500 mt-0.5'>
                      (доступно 10 шт)
                    </p>
                  </div>

                  {/* Quantity Controls */}
                  <div className='flex items-center gap-1'>
                    <button
                      type='button'
                      onClick={() =>
                        updateItemQuantity(item.productId!, item.quantity - 1)
                      }
                      className='text-red-400 hover:text-red-600 transition-colors'
                    >
                      <CircleMinus size={22} strokeWidth={2.5} />
                    </button>
                    <div className='flex items-center border border-gray-300 rounded px-2 py-1 bg-white'>
                      <input
                        type='number'
                        value={item.quantity}
                        onChange={(e) =>
                          updateItemQuantity(
                            item.productId!,
                            Number(e.target.value),
                          )
                        }
                        className='w-10 text-center text-sm font-semibold focus:outline-none'
                      />
                      <span className='text-[10px] text-gray-400 font-medium ml-1'>
                        шт
                      </span>
                    </div>
                    <button
                      type='button'
                      onClick={() =>
                        updateItemQuantity(item.productId!, item.quantity + 1)
                      }
                      className='text-green-500 hover:text-green-600 transition-colors'
                    >
                      <CirclePlus size={22} strokeWidth={2.5} />
                    </button>
                  </div>

                  {/* Price Input */}
                  <div className='flex items-center border border-gray-300 rounded px-2 py-1 bg-white min-w-[100px]'>
                    <input
                      type='number'
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateItemPrice(item.productId!, Number(e.target.value))
                      }
                      className='w-full text-right text-sm font-semibold focus:outline-none'
                    />
                    <span className='text-[10px] text-gray-400 font-medium ml-1'>
                      грн.
                    </span>
                  </div>

                  {/* Row Total */}
                  <div className='flex items-center gap-2 min-w-[120px] justify-end'>
                    <ChevronDown size={14} className='text-blue-500' />
                    <span className='text-sm font-bold text-gray-700'>
                      {(item.totalPrice || 0).toFixed(2)} грн.
                    </span>
                  </div>

                  {/* Delete Button */}
                  <button
                    type='button'
                    onClick={() => removeItem(index)}
                    className='text-blue-500 hover:text-red-500 p-1 transition-colors'
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}

              {/* Summary Counter */}
              {formData.items.length > 0 && (
                <div className='text-right pt-2 text-gray-700 font-bold'>
                  Усього: {formData.items.length} найм. (
                  {formData.items.reduce((a, b) => a + b.quantity, 0)} од.)
                </div>
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
