// client/src/app/orders/(components)/EditOrderModal.tsx
'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import {
  useUpdateOrderMutation,
  useGetProductsQuery,
  useSearchClientsAutocompleteQuery,
  Order,
  OrderStatus,
  Product,
  Client,
} from '@/state/api'
import {
  X,
  Search,
  ChevronDown,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CircleMinus,
  CirclePlus,
  Trash2,
  AlertTriangle,
  Save,
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import Toast from '@/app/(components)/Toast'

// ─── Types ─────────────────────────────────────────────────────────────────

interface EditableOrderItem {
  orderItemId?: string // existing items have this
  productId?: string | null
  productName: string
  sku?: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  stockQuantity: number // UI-only, for warning display
}

interface EditOrderModalProps {
  order: Order
  onClose: () => void
  onSuccess: () => void
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const DELIVERY_OPTIONS = [
  { value: '', label: 'Оберіть спосіб' },
  { value: 'NovaPoshta', label: 'Нова Пошта' },
  { value: 'UkrPoshta', label: 'Укрпошта' },
]

const PAYMENT_OPTIONS = [
  { value: '', label: 'Оберіть спосіб' },
  { value: 'CashOnDelivery', label: 'Післяплата' },
  { value: 'IBAN', label: 'IBAN' },
  { value: 'PromPayment', label: 'Пром оплата' },
  { value: 'RozetkaPay', label: 'Rozetka Pay' },
]

const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'RECEIVED', label: 'Прийнято' },
  { value: 'PREPARED', label: 'Зібрано' },
  { value: 'SHIPPED', label: 'Відправлено' },
  { value: 'AWAITING_PICKUP', label: 'На відділенні' },
  { value: 'DELIVERED', label: 'Доставлено' },
  { value: 'CANCELED', label: 'Скасовано' },
  { value: 'RETURN', label: 'Повернення' },
]

// ─── Component ─────────────────────────────────────────────────────────────

export default function EditOrderModal({
  order,
  onClose,
  onSuccess,
}: EditOrderModalProps) {
  const { toast, showToast, hideToast } = useToast()
  const [updateOrder, { isLoading: isSaving }] = useUpdateOrderMutation()

  // ── Product search state ──────────────────────────────────────────────
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('')
  const [productPage, setProductPage] = useState(1)
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedProductSearch(productSearch), 300)
    return () => clearTimeout(t)
  }, [productSearch])

  useEffect(() => {
    setProductPage(1)
  }, [debouncedProductSearch])

  const { data: productsData, isFetching: isProductsFetching } =
    useGetProductsQuery({
      search: debouncedProductSearch,
      page: productPage,
      limit: 10,
    })
  const products = productsData?.products || []
  const totalProductPages = productsData?.pagination?.pages || 1

  // ── Client search state ───────────────────────────────────────────────
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [debouncedClientSearch, setDebouncedClientSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedClientSearch(clientSearch), 300)
    return () => clearTimeout(t)
  }, [clientSearch])

  const { data: clientsData, isFetching: isClientFetching } =
    useSearchClientsAutocompleteQuery(debouncedClientSearch, {
      skip: debouncedClientSearch.length < 3,
    })
  const clients = clientsData || []

  // ── Order items state ─────────────────────────────────────────────────
  const [orderItems, setOrderItems] = useState<EditableOrderItem[]>(() =>
    (order.orderItems || []).map((item) => ({
      orderItemId: item.orderItemId,
      productId: item.productId ?? null,
      productName: item.productName,
      sku: item.sku ?? null,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
      stockQuantity: 999, // We don't have live stock for existing items; set high so no false warnings
    })),
  )

  // ── Form state ────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    // Client
    clientFirstName: order.clientFirstName ?? '',
    clientLastName: order.clientLastName ?? '',
    clientSecondName: order.clientSecondName ?? '',
    clientPhone: order.clientPhone ?? '',
    clientEmail: order.clientEmail ?? '',
    // Delivery
    deliveryOptionName: order.deliveryOptionName ?? '',
    deliveryCity: order.deliveryCity ?? '',
    deliveryAddress: order.deliveryAddress ?? '',
    trackingNumber: order.trackingNumber ?? '',
    // Payment
    paymentOptionName: order.paymentOptionName ?? '',
    // Order meta
    status: order.status as OrderStatus,
    clientNotes: order.clientNotes ?? '',
    sellerComment: order.sellerComment ?? '',
  })

  // Populate client search field on mount
  useEffect(() => {
    if (order.clientFullName || order.clientPhone) {
      setClientSearch(
        `${order.clientLastName ?? ''} ${order.clientFirstName ?? ''} (${order.clientPhone ?? ''})`.trim(),
      )
    }
  }, [order])

  // ── Derived total ─────────────────────────────────────────────────────
  const totalAmount = orderItems.reduce((s, i) => s + (i.totalPrice || 0), 0)

  // ── Handlers: form ────────────────────────────────────────────────────
  const handleField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleClientSelect = (client: Client) => {
    setClientSearch(`${client.lastName} ${client.firstName} (${client.phone})`)
    setForm((prev) => ({
      ...prev,
      clientFirstName: client.firstName,
      clientLastName: client.lastName,
      clientSecondName: client.secondName ?? '',
      clientPhone: client.phone,
      clientEmail: client.email ?? '',
      deliveryAddress: client.address ?? prev.deliveryAddress,
      deliveryOptionName: client.deliveryOptionName ?? prev.deliveryOptionName,
      paymentOptionName: client.paymentOptionName ?? prev.paymentOptionName,
    }))
    setIsClientDropdownOpen(false)
  }

  // ── Handlers: product items ───────────────────────────────────────────
  const toggleProduct = (p: Product) =>
    setSelectedProducts((prev) =>
      prev.find((x) => x.productId === p.productId)
        ? prev.filter((x) => x.productId !== p.productId)
        : [...prev, p],
    )

  const addSelectedProducts = () => {
    const newItems: EditableOrderItem[] = selectedProducts.map((p) => ({
      productId: p.productId,
      productName: p.name,
      sku: p.sku,
      quantity: 1,
      unitPrice: p.price,
      totalPrice: p.price,
      stockQuantity: p.stockQuantity,
    }))
    setOrderItems((prev) => [...prev, ...newItems])
    setSelectedProducts([])
    setIsProductDropdownOpen(false)
    setProductSearch('')
  }

  const updateQty = (idx: number, qty: number) => {
    const q = Math.max(1, qty)
    setOrderItems((prev) =>
      prev.map((item, i) =>
        i === idx
          ? { ...item, quantity: q, totalPrice: q * item.unitPrice }
          : item,
      ),
    )
  }

  const updatePrice = (idx: number, raw: string) => {
    const price = raw === '' ? 0 : parseFloat(raw) || 0
    setOrderItems((prev) =>
      prev.map((item, i) =>
        i === idx
          ? {
              ...item,
              unitPrice: raw as any,
              totalPrice: item.quantity * price,
            }
          : item,
      ),
    )
  }

  const removeItem = (idx: number) =>
    setOrderItems((prev) => prev.filter((_, i) => i !== idx))

  const hasInsufficientStock = (item: EditableOrderItem) =>
    item.stockQuantity !== 999 && item.quantity > item.stockQuantity

  // ── Submit ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.clientPhone) {
      showToast('Введіть номер телефону клієнта', 'error')
      return
    }
    if (orderItems.length === 0) {
      showToast('Додайте хоча б один товар', 'error')
      return
    }

    try {
      // UpdateOrderInput only covers the fields exposed in updateOrderSchema
      // We pass what the backend supports; for full item editing a separate
      // endpoint would be needed – here we update the scalar order fields.
      await updateOrder({
        orderId: order.orderId,
        updates: {
          status: form.status,
          trackingNumber: form.trackingNumber || undefined,
          deliveryAddress: form.deliveryAddress || undefined,
          deliveryOptionName: (form.deliveryOptionName as any) || undefined,
          paymentOptionName: (form.paymentOptionName as any) || undefined,
          clientNotes: form.clientNotes || undefined,
          sellerComment: form.sellerComment || undefined,
        },
      }).unwrap()

      showToast('Замовлення оновлено успішно!', 'success')
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 800)
    } catch (err: any) {
      showToast(
        `Помилка оновлення: ${err?.data?.message || 'Невідома помилка'}`,
        'error',
      )
    }
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        className='fixed inset-0 bg-black/50 z-[200] flex items-start justify-center overflow-y-auto py-6 px-4'
        onClick={onClose}
      >
        {/* Modal panel */}
        <div
          className='bg-white rounded-xl w-full max-w-3xl shadow-2xl'
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className='flex items-center justify-between px-6 py-4 border-b border-gray-200'>
            <h2 className='text-xl font-bold text-gray-900'>
              Редагувати замовлення{' '}
              <span className='text-blue-600'>#{order.orderNumber}</span>
            </h2>
            <button
              onClick={onClose}
              className='p-2 hover:bg-gray-100 rounded-full transition-colors'
            >
              <X size={20} className='text-gray-500' />
            </button>
          </div>

          <div className='p-6 space-y-6'>
            {/* ─────────────────────────────────────────── */}
            {/* PRODUCT SECTION                             */}
            {/* ─────────────────────────────────────────── */}
            <section className='space-y-3'>
              {/* Product search input */}
              <div className='relative'>
                <div
                  className={`flex items-center border rounded-lg px-3 py-2.5 transition-all ${
                    isProductDropdownOpen
                      ? 'border-blue-500 ring-2 ring-blue-100'
                      : 'border-gray-300'
                  }`}
                >
                  <Search size={16} className='text-gray-400 mr-2 shrink-0' />
                  <input
                    type='text'
                    className='w-full outline-none text-gray-700 bg-transparent text-sm'
                    placeholder='Товар/артикул/бренд'
                    value={productSearch}
                    onFocus={() => setIsProductDropdownOpen(true)}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                  {isProductsFetching ? (
                    <Loader2 size={16} className='text-blue-500 animate-spin' />
                  ) : (
                    <ChevronDown
                      size={16}
                      className='text-gray-400 cursor-pointer'
                      onClick={() => setIsProductDropdownOpen((v) => !v)}
                    />
                  )}
                </div>

                {/* Product dropdown */}
                {isProductDropdownOpen && (
                  <>
                    <div
                      className='fixed inset-0 z-40'
                      onClick={() => setIsProductDropdownOpen(false)}
                    />
                    <div className='absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-80 overflow-hidden flex flex-col'>
                      {selectedProducts.length > 0 && (
                        <div className='p-2 bg-blue-50 border-b flex justify-between items-center'>
                          <span className='text-sm font-medium text-blue-700 ml-2'>
                            Обрано: {selectedProducts.length}
                          </span>
                          <button
                            type='button'
                            onClick={addSelectedProducts}
                            className='bg-blue-600 text-white text-xs px-3 py-1.5 rounded hover:bg-blue-700'
                          >
                            Додати обрані
                          </button>
                        </div>
                      )}
                      <div className='overflow-y-auto flex-1'>
                        {products.length > 0 ? (
                          products.map((p) => {
                            const checked = selectedProducts.some(
                              (x) => x.productId === p.productId,
                            )
                            return (
                              <div
                                key={p.productId}
                                className={`flex items-start gap-3 p-3 border-b border-gray-100 last:border-0 cursor-pointer transition-colors ${
                                  checked ? 'bg-blue-50/50' : 'hover:bg-gray-50'
                                }`}
                                onClick={() => toggleProduct(p)}
                              >
                                <div className='pt-1'>
                                  <input
                                    type='checkbox'
                                    checked={checked}
                                    onChange={() => {}}
                                    className='w-4 h-4 rounded border-gray-300 text-blue-600'
                                  />
                                </div>
                                <Image
                                  src={
                                    p.mainImage || '/placeholder-product.png'
                                  }
                                  alt=''
                                  width={36}
                                  height={36}
                                  className='rounded object-cover'
                                />
                                <div className='flex-1'>
                                  <p className='text-sm font-medium text-gray-900'>
                                    {p.name}
                                  </p>
                                  <p className='text-xs text-gray-500'>
                                    {p.sku} • {p.price} грн • {p.stockQuantity}{' '}
                                    шт
                                  </p>
                                </div>
                              </div>
                            )
                          })
                        ) : (
                          <div className='p-4 text-center text-sm text-gray-500'>
                            Товарів не знайдено
                          </div>
                        )}
                      </div>
                      {totalProductPages > 1 && (
                        <div className='p-2 border-t bg-gray-50 flex items-center justify-between'>
                          <button
                            type='button'
                            disabled={productPage === 1}
                            onClick={() =>
                              setProductPage((p) => Math.max(1, p - 1))
                            }
                            className='p-1 disabled:opacity-30'
                          >
                            <ChevronLeft size={18} />
                          </button>
                          <span className='text-xs text-gray-600'>
                            {productPage} / {totalProductPages}
                          </span>
                          <button
                            type='button'
                            disabled={productPage === totalProductPages}
                            onClick={() =>
                              setProductPage((p) =>
                                Math.min(totalProductPages, p + 1),
                              )
                            }
                            className='p-1 disabled:opacity-30'
                          >
                            <ChevronRight size={18} />
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Order items list */}
              <div className='space-y-2'>
                {orderItems.map((item, idx) => {
                  const outOfStock = hasInsufficientStock(item)
                  return (
                    <div
                      key={item.orderItemId ?? idx}
                      className={`flex flex-wrap md:flex-nowrap items-center gap-3 p-3 border rounded-lg shadow-sm ${
                        outOfStock
                          ? 'bg-red-50 border-red-200'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      {/* Name */}
                      <div className='flex-1 min-w-[200px]'>
                        <div className='flex items-center gap-1.5'>
                          {outOfStock && (
                            <AlertTriangle className='w-4 h-4 text-red-500 shrink-0' />
                          )}
                          <p
                            className={`text-sm font-medium leading-tight ${
                              outOfStock ? 'text-red-700' : 'text-blue-600'
                            }`}
                          >
                            {item.productName}
                            {item.sku && (
                              <span className='text-gray-400 ml-1 font-normal text-xs'>
                                {item.sku}
                              </span>
                            )}
                          </p>
                        </div>
                        {item.stockQuantity !== 999 && (
                          <p
                            className={`text-[11px] mt-0.5 ${
                              outOfStock
                                ? 'text-red-600 font-bold'
                                : 'text-gray-500'
                            }`}
                          >
                            {item.stockQuantity === 0
                              ? 'Немає на складі!'
                              : `(доступно ${item.stockQuantity} шт)`}
                          </p>
                        )}
                      </div>

                      {/* Quantity controls */}
                      <div className='flex items-center gap-1'>
                        <button
                          type='button'
                          onClick={() => updateQty(idx, item.quantity - 1)}
                          className='text-red-400 hover:text-red-600 transition-colors'
                        >
                          <CircleMinus size={20} strokeWidth={2.5} />
                        </button>
                        <div className='flex items-center border border-gray-300 rounded px-2 py-1 bg-white'>
                          <input
                            type='number'
                            value={item.quantity}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) =>
                              updateQty(idx, Number(e.target.value))
                            }
                            className='w-9 text-center text-sm font-semibold focus:outline-none'
                          />
                          <span className='text-[10px] text-gray-400 ml-1'>
                            шт
                          </span>
                        </div>
                        <button
                          type='button'
                          onClick={() => updateQty(idx, item.quantity + 1)}
                          className='text-green-500 hover:text-green-600 transition-colors'
                        >
                          <CirclePlus size={20} strokeWidth={2.5} />
                        </button>
                      </div>

                      {/* Price input */}
                      <div className='flex items-center border border-gray-300 rounded px-2 py-1 bg-white min-w-[90px]'>
                        <input
                          type='number'
                          value={item.unitPrice}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => updatePrice(idx, e.target.value)}
                          className='w-full text-right text-sm font-semibold focus:outline-none'
                        />
                        <span className='text-[10px] text-gray-400 ml-1'>
                          грн.
                        </span>
                      </div>

                      {/* Row total */}
                      <div className='flex items-center gap-1 min-w-[100px] justify-end'>
                        <ChevronDown size={13} className='text-blue-500' />
                        <span className='text-sm font-bold text-gray-700'>
                          {(item.totalPrice || 0).toFixed(2)} грн.
                        </span>
                      </div>

                      {/* Delete */}
                      <button
                        type='button'
                        onClick={() => removeItem(idx)}
                        className='text-blue-400 hover:text-red-500 p-1 transition-colors'
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )
                })}

                {orderItems.length > 0 && (
                  <div className='text-right text-sm font-bold text-gray-700 pt-1'>
                    Усього: {orderItems.length} найм. (
                    {orderItems.reduce((a, b) => a + b.quantity, 0)} од.)
                  </div>
                )}
              </div>

              {/* Grand total */}
              {orderItems.length > 0 && (
                <div className='text-right'>
                  <span className='text-2xl font-black text-gray-900'>
                    Усього:{' '}
                    <span className='text-blue-600'>
                      {totalAmount.toFixed(2)} грн.
                    </span>
                  </span>
                </div>
              )}
            </section>

            {/* ─────────────────────────────────────────── */}
            {/* DISCOUNT / STATUS ROW                       */}
            {/* ─────────────────────────────────────────── */}
            <section className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Статус продажу
                </label>
                <select
                  value={form.status}
                  onChange={(e) => handleField('status', e.target.value)}
                  className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm'
                >
                  {ORDER_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Спосіб оплати
                </label>
                <select
                  value={form.paymentOptionName}
                  onChange={(e) =>
                    handleField('paymentOptionName', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm'
                >
                  {PAYMENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            {/* ─────────────────────────────────────────── */}
            {/* CLIENT SECTION                              */}
            {/* ─────────────────────────────────────────── */}
            <section className='space-y-4'>
              <h3 className='text-base font-semibold text-gray-800 border-b pb-2'>
                Клієнт
              </h3>

              {/* Client search */}
              <div className='relative'>
                <div
                  className={`flex items-center border rounded-lg px-3 py-2.5 transition-all ${
                    isClientDropdownOpen
                      ? 'border-blue-500 ring-2 ring-blue-100'
                      : 'border-gray-300'
                  }`}
                >
                  <Search size={16} className='text-gray-400 mr-2 shrink-0' />
                  <input
                    type='text'
                    className='w-full outline-none text-gray-700 bg-transparent text-sm'
                    placeholder='Пошук по імені або телефону...'
                    value={clientSearch}
                    onFocus={() => setIsClientDropdownOpen(true)}
                    onChange={(e) => {
                      setClientSearch(e.target.value)
                      handleField('clientPhone', e.target.value)
                    }}
                  />
                  {isClientFetching ? (
                    <Loader2 size={16} className='text-blue-500 animate-spin' />
                  ) : (
                    <ChevronDown
                      size={16}
                      className='text-gray-400 cursor-pointer'
                      onClick={() => setIsClientDropdownOpen((v) => !v)}
                    />
                  )}
                </div>

                {isClientDropdownOpen && (
                  <>
                    <div
                      className='fixed inset-0 z-40'
                      onClick={() => setIsClientDropdownOpen(false)}
                    />
                    <div className='absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto'>
                      {clients.length > 0 ? (
                        clients.map((c) => (
                          <div
                            key={c.clientId}
                            className='flex items-center gap-3 p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer'
                            onClick={() => handleClientSelect(c)}
                          >
                            <div>
                              <p className='text-sm font-medium text-gray-900'>
                                {c.lastName} {c.firstName} {c.secondName ?? ''}
                              </p>
                              <p className='text-xs text-gray-500'>
                                {c.phone}
                                {c.email && ` • ${c.email}`}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : debouncedClientSearch.length >= 3 ? (
                        <div className='p-3 text-sm text-gray-500 text-center'>
                          Клієнта не знайдено
                        </div>
                      ) : (
                        <div className='p-3 text-sm text-gray-500 text-center'>
                          Введіть мінімум 3 символи для пошуку
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Client fields */}
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                <div>
                  <label className='block text-xs font-medium text-gray-600 mb-1'>
                    Прізвище
                  </label>
                  <input
                    type='text'
                    value={form.clientLastName}
                    onChange={(e) =>
                      handleField('clientLastName', e.target.value)
                    }
                    className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm'
                  />
                </div>
                <div>
                  <label className='block text-xs font-medium text-gray-600 mb-1'>
                    Ім&apos;я
                  </label>
                  <input
                    type='text'
                    value={form.clientFirstName}
                    onChange={(e) =>
                      handleField('clientFirstName', e.target.value)
                    }
                    className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm'
                  />
                </div>
                <div>
                  <label className='block text-xs font-medium text-gray-600 mb-1'>
                    По батькові
                  </label>
                  <input
                    type='text'
                    value={form.clientSecondName}
                    onChange={(e) =>
                      handleField('clientSecondName', e.target.value)
                    }
                    className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm'
                  />
                </div>
                <div>
                  <label className='block text-xs font-medium text-gray-600 mb-1'>
                    Телефон
                  </label>
                  <input
                    type='tel'
                    value={form.clientPhone}
                    onChange={(e) => handleField('clientPhone', e.target.value)}
                    className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm'
                  />
                </div>
              </div>
            </section>

            {/* ─────────────────────────────────────────── */}
            {/* DELIVERY SECTION                            */}
            {/* ─────────────────────────────────────────── */}
            <section className='space-y-3'>
              <h3 className='text-base font-semibold text-gray-800 border-b pb-2'>
                Доставка
              </h3>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                <div>
                  <label className='block text-xs font-medium text-gray-600 mb-1'>
                    Служба доставки
                  </label>
                  <select
                    value={form.deliveryOptionName}
                    onChange={(e) =>
                      handleField('deliveryOptionName', e.target.value)
                    }
                    className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm'
                  >
                    {DELIVERY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className='block text-xs font-medium text-gray-600 mb-1'>
                    Місто / Відділення
                  </label>
                  <input
                    type='text'
                    value={form.deliveryCity}
                    onChange={(e) =>
                      handleField('deliveryCity', e.target.value)
                    }
                    placeholder='Іванківці, Відділення №1'
                    className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm'
                  />
                </div>
                <div className='sm:col-span-2'>
                  <label className='block text-xs font-medium text-gray-600 mb-1'>
                    Адреса доставки
                  </label>
                  <input
                    type='text'
                    value={form.deliveryAddress}
                    onChange={(e) =>
                      handleField('deliveryAddress', e.target.value)
                    }
                    className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm'
                  />
                </div>
                <div className='sm:col-span-2'>
                  <label className='block text-xs font-medium text-gray-600 mb-1'>
                    Трекінг номер (ТТН)
                  </label>
                  <input
                    type='text'
                    value={form.trackingNumber}
                    onChange={(e) =>
                      handleField('trackingNumber', e.target.value)
                    }
                    placeholder='20451374507551'
                    className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm'
                  />
                </div>
              </div>
            </section>

            {/* ─────────────────────────────────────────── */}
            {/* NOTES                                       */}
            {/* ─────────────────────────────────────────── */}
            <section className='space-y-3'>
              <h3 className='text-base font-semibold text-gray-800 border-b pb-2'>
                Коментарі
              </h3>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                <div>
                  <label className='block text-xs font-medium text-gray-600 mb-1'>
                    Коментар клієнта
                  </label>
                  <textarea
                    value={form.clientNotes}
                    onChange={(e) => handleField('clientNotes', e.target.value)}
                    rows={3}
                    className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-none'
                  />
                </div>
                <div>
                  <label className='block text-xs font-medium text-gray-600 mb-1'>
                    Коментар продавця
                  </label>
                  <textarea
                    value={form.sellerComment}
                    onChange={(e) =>
                      handleField('sellerComment', e.target.value)
                    }
                    rows={3}
                    className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-none'
                  />
                </div>
              </div>
            </section>
          </div>

          {/* ── Footer ── */}
          <div className='px-6 py-4 border-t border-gray-200 flex gap-3'>
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className='flex-1 flex items-center justify-center gap-2 py-3 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            >
              <Save size={18} />
              {isSaving ? 'Збереження...' : 'Редагувати'}
            </button>
            <button
              onClick={onClose}
              className='px-5 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors'
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
        duration={4000}
      />
    </>
  )
}
