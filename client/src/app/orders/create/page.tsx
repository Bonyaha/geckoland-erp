// client/src/app/orders/create/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  useCreateCRMOrderMutation,
  useGetProductsQuery,
  useSearchClientsAutocompleteQuery,
  /* useGetOrCreateClientMutation */
  Product,
  CreateCRMOrderInput,
  type Client,
  useGetClientAddressesQuery,
  type ClientAddress,
} from '@/state/api'

import {
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
  UserPlus,
  AlertTriangle,
  Copy,
  MapPin,
  Plus,
} from 'lucide-react'

import { useToast } from '@/hooks/useToast'
import Toast from '@/app/(components)/Toast'

import { AddAddressModal } from '../(components)'

import { PAYMENT_OPTIONS } from '@/utils/marketplaceUtils'

import { NpCitySearch, NpWarehouseSearch } from '@/app/(components)/NovaPoshtaSearch'
import type { NpCity } from '@/hooks/useNovaPoshtaAutocomplete'

type OrderItemWithStock = NonNullable<CreateCRMOrderInput['items']>[number] & {
  stockQuantity: number
}

const CreateOrderPage = () => {
  const router = useRouter()
  const { toast, showToast, hideToast } = useToast()

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE - Form Data(items excluded — managed separately in orderItems)
  // ═══════════════════════════════════════════════════════════════════════════
  const [formData, setFormData] = useState<Omit<CreateCRMOrderInput, 'items'>>({
    clientFirstName: '',
    clientLastName: '',
    clientSecondName: '',
    clientPhone: '',
    clientEmail: '',
    deliveryAddress: '',
    deliveryOptionName: '',
    paymentOptionName: '',
    totalAmount: 0,
    currency: 'UAH',
    clientNotes: '',
  })

  // Order items
  const [orderItems, setOrderItems] = useState<OrderItemWithStock[]>([])

  // Prefill banner
  const [isPrefilled, setIsPrefilled] = useState(false)

  // ─── NP Autocomplete State ───────────────────────────────────────────────────
  // Stores the city display string typed by the user
  const [npCityQuery, setNpCityQuery] = useState('')
  // Stores the DeliveryCity ref returned by Nova Poshta (needed for warehouse lookup)
  const [npCityRef, setNpCityRef] = useState('')
  // Stores the warehouse display string typed by the user
  const [npWarehouseQuery, setNpWarehouseQuery] = useState('')

  // ─── NP Address Dropdown State ────────────────────────────────────────────
  const [isNpAddressDropdownOpen, setIsNpAddressDropdownOpen] = useState(false)
  const [selectedNpAddressId, setSelectedNpAddressId] = useState<string | null>(
    null,
  )
  const npAddressDropdownRef = useRef<HTMLDivElement>(null)

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE - Product Search & Selection
  // ═══════════════════════════════════════════════════════════════════════════
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([])
  const [prefilledSkus, setPrefilledSkus] = useState<string>('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE - Client Search & Selection & Address Management
  // ═══════════════════════════════════════════════════════════════════════════

  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false)
  const [clientSearchTerm, setClientSearchTerm] = useState('')
  const [debouncedClientSearch, setDebouncedClientSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [isAddressDropdownOpen, setIsAddressDropdownOpen] = useState(false)
  const [showAddAddressModal, setShowAddAddressModal] = useState(false)

  // ═══════════════════════════════════════════════════════════════════════════
  // API QUERIES & MUTATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  const [createOrder, { isLoading }] = useCreateCRMOrderMutation()

  // Fetch products from API(for manual search)
  const { data: productsData, isFetching } = useGetProductsQuery({
    search: debouncedSearch,
    page: currentPage,
    limit: 10,
  })

  // Fetch stock for prefilled items using their SKUs
  const { data: prefilledProductsData } = useGetProductsQuery(
    {
      search: prefilledSkus,
      page: 1,
      limit: 50, // Higher limit to catch all prefilled items
    },
    {
      skip: !prefilledSkus, // Only run when we have SKUs to search
    },
  )

  // Fetch clients
  const { data: clientsData, isFetching: isClientFetching } =
    useSearchClientsAutocompleteQuery(debouncedClientSearch, {
      skip: debouncedClientSearch.length < 3,
    })

  // Fetch addresses when client is selected
  const { data: clientAddresses } = useGetClientAddressesQuery(
    selectedClient?.clientId || '',
    { skip: !selectedClient?.clientId },
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED VALUES
  // ═══════════════════════════════════════════════════════════════════════════
  const products = productsData?.products || []
  const totalPages = productsData?.pagination?.pages || 1
  const clients = clientsData || []

  // NovaPoshta addresses from client
  const npAddresses = clientAddresses?.filter(
    (a) => !a.deliveryOptionName || a.deliveryOptionName === 'NovaPoshta',
  ) || []

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECTS - Close NP address dropdown on outside click
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        npAddressDropdownRef.current &&
        !npAddressDropdownRef.current.contains(e.target as Node)
      ) {
        setIsNpAddressDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECTS - Prefill from sessionStorage (Copy Sale)
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const raw = sessionStorage.getItem('order_prefill')
    if (!raw) return

    try {
      const prefill = JSON.parse(raw)
      //console.log('prefill is: ',prefill);

      sessionStorage.removeItem('order_prefill') // consume once

      setIsPrefilled(true)

      setFormData((prev) => ({
        ...prev,
        clientFirstName: prefill.clientFirstName ?? prev.clientFirstName,
        clientLastName: prefill.clientLastName ?? prev.clientLastName,
        clientSecondName: prefill.clientSecondName ?? prev.clientSecondName,
        clientPhone: prefill.clientPhone ?? prev.clientPhone,
        clientEmail: prefill.clientEmail ?? prev.clientEmail,
        deliveryAddress: '',
        deliveryOptionName:
          prefill.deliveryOptionName ?? prev.deliveryOptionName,
        paymentOptionName: prefill.paymentOptionName ?? prev.paymentOptionName,
        clientNotes: prefill.clientNotes ?? prev.clientNotes,
      }))

      // Pre-populate client search display
      if (prefill.clientLastName || prefill.clientPhone) {
        setClientSearchTerm(
          `${prefill.clientLastName ?? ''} ${prefill.clientFirstName ?? ''} (${prefill.clientPhone ?? ''})`.trim(),
        )
      }

      // Pre-populate items - stock quantities will be updated from fetched products
      if (Array.isArray(prefill.items) && prefill.items.length > 0) {
        const items: OrderItemWithStock[] = prefill.items.map((item: any) => ({
          productId: item.productId ?? undefined,
          productName: item.productName,
          sku: item.sku ?? undefined,
          quantity: item.quantity ?? 1,
          stockQuantity: 0, // Will be updated when products are fetched
          unitPrice: item.unitPrice ?? 0,
          totalPrice: item.totalPrice ?? item.unitPrice ?? 0,
        }))
        setOrderItems(items)

        // Trigger a search for all SKUs to fetch stock data
        const skus = items
          .map((i) => i.sku)
          .filter(Boolean)
          .join(' ')
        if (skus) {
          setPrefilledSkus(skus)
        }
      }
    } catch (e) {
      console.error('Failed to parse order prefill', e)
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECTS - Debouncing
  // ═══════════════════════════════════════════════════════════════════════════
  // Debounce logic for products
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Debounce logic for clients
  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedClientSearch(clientSearchTerm),
      300,
    )
    return () => clearTimeout(timer)
  }, [clientSearchTerm])

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECTS - Product Search Pagination
  // ═══════════════════════════════════════════════════════════════════════════
  // Reset to page 1 when searching products
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch])

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECTS - Stock Quantity Updates
  // ═══════════════════════════════════════════════════════════════════════════
  // Update stock quantities for order items when products data changes
  useEffect(() => {
    if (!prefilledProductsData?.products || orderItems.length === 0) return

    setOrderItems((prevItems) =>
      prevItems.map((item) => {
        const product = prefilledProductsData.products.find(
          (p) => p.productId === item.productId || p.sku === item.sku,
        )
        // Update stock if we found the product
        if (product) {
          return {
            ...item,
            stockQuantity: product.stockQuantity,
          }
        }
        return item
      }),
    )
  }, [prefilledProductsData, orderItems.length])

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECTS - Total Amount Calculation
  // ═══════════════════════════════════════════════════════════════════════════
  // Recalculate total amount whenever items change
  useEffect(() => {
    const total = orderItems.reduce(
      (sum, item) => sum + (item.totalPrice || 0),
      0,
    )
    setFormData((prev) => ({ ...prev, totalAmount: total }))
  }, [orderItems])

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERS - Form Input
  // ═══════════════════════════════════════════════════════════════════════════
  const handleInputChange = (field: keyof CreateCRMOrderInput, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERS - Client Selection
  // ═══════════════════════════════════════════════════════════════════════════
  const handleClientSelect = (client: Client) => {
    setSelectedClient(client)
    setClientSearchTerm(
      `${client.lastName} ${client.firstName} (${client.phone})`,
    )
    setFormData((prev) => ({
      ...prev,
      clientFirstName: client.firstName,
      clientLastName: client.lastName,
      clientSecondName: client.secondName || '',
      clientPhone: client.phone,
      clientEmail: client.email || '',
      deliveryAddress: '',
      deliveryOptionName: client.deliveryOptionName || '',
      paymentOptionName: client.paymentOptionName || '',
    }))
    setIsClientDropdownOpen(false)
  }

  // Handle manual client data change (when user types in fields)
  const handleManualClientChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))

    // If phone changes, clear selected client
    if (field === 'clientPhone') {
      /* setSelectedClient(null) */
      setClientSearchTerm(value)
    }
  }

  // Create new client from search term
  const handleCreateNewClient = () => {
    // Clear the search field and close dropdown
    setClientSearchTerm('')
    setIsClientDropdownOpen(false)

    // Clear all client fields to allow manual entry
    setFormData((prev) => ({
      ...prev,
      clientPhone: '',
      clientFirstName: '',
      clientLastName: '',
      clientSecondName: '',
      clientEmail: '',
      deliveryAddress: '',
      deliveryOptionName: '',
      paymentOptionName: '',
    }))
  }

  // HANDLERS - Address Selection

  const handleAddressSelect = (address: ClientAddress) => {
    setFormData((prev) => ({
      ...prev,
      deliveryAddress: address.address,
      deliveryOptionName: address.deliveryOptionName || prev.deliveryOptionName,
    }))
    setIsAddressDropdownOpen(false)
  }

  const handleNewAddressAdded = (address: {
    addressId: string
    address: string
    deliveryOptionName?: string | null
  }) => {
    setFormData((prev) => ({
      ...prev,
      deliveryAddress: address.address,
      deliveryOptionName: address.deliveryOptionName || prev.deliveryOptionName,
    }))
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERS - Nova Poshta Saved Address Selection
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Parse a saved address string like "Хмельницький, Відділення №21 (до 30 кг): просп. Миру, 80"
   * into city part and warehouse part.
   */
  const parseNpAddress = (
    address: string,
  ): { city: string; warehouse: string } => {
    // The address is stored as "CityName, WarehouseDescription"
    // Split on first comma to separate city from warehouse
    const commaIdx = address.indexOf(', ')
    if (commaIdx === -1) return { city: address, warehouse: '' }
    return {
      city: address.substring(0, commaIdx).trim(),
      warehouse: address.substring(commaIdx + 2).trim(),
    }
  }

  const handleNpSavedAddressSelect = (address: ClientAddress) => {
    setSelectedNpAddressId(address.addressId)
    setIsNpAddressDropdownOpen(false)

    const { city, warehouse } = parseNpAddress(address.address)

    // Prefill the city search field
    setNpCityQuery(city)

    // Prefill the warehouse search field
    setNpWarehouseQuery(warehouse)

    // Set the deliveryAddress that will be saved
    setFormData((prev) => ({ ...prev, deliveryAddress: address.address }))

    // Note: npCityRef will be empty until the user re-selects city from NP API.
    // The warehouse search won't work without cityRef, but the display is prefilled.
    // This is intentional — if user wants to change warehouse they re-select city first.
  }

  // ═══════════════════════════════════════════════════════════v════════════════
  // HANDLERS - Nova Poshta Autocomplete
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── NP City selected ────────────────────────────────────────────────────────
  const handleNpCitySelect = (city: NpCity) => {
    // HANDLERS - Product Selection

    // Store city ref for warehouse lookup

    // ═══════════════════════════════════════════════════════════════════════════

    setNpCityRef(city.DeliveryCity)

    // Logic for Checkboxes and Adding Multiple Items

    // Clear warehouse when city changes

    setNpWarehouseQuery('')

    setFormData((prev) => ({ ...prev, deliveryAddress: '' }))

    // Auto-select NovaPoshta delivery if not already set

    setFormData((prev) => ({
      ...prev,

      deliveryOptionName: prev.deliveryOptionName || 'NovaPoshta',
    }))
    // Clear saved address selection when manually changing city
    setSelectedNpAddressId(null)
  }

  // ─── NP Warehouse selected ───────────────────────────────────────────────────

  const handleNpWarehouseSelect = (
    w: import('@/hooks/useNovaPoshtaAutocomplete').NpWarehouse,
  ) => {
    // Build a combined delivery address: city + warehouse description

    const cityName = npCityQuery.split(',')[0]?.trim() || ''

    const combined = cityName ? `${cityName}, ${w.Description}` : w.Description

    setFormData((prev) => ({ ...prev, deliveryAddress: combined }))
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERS - Product Selection
  // ═══════════════════════════════════════════════════════════════════════════
  // Logic for Checkboxes and Adding Multiple Items
  const toggleProductSelection = (product: Product) => {
    setSelectedProducts((prev) =>
      prev.find((p) => p.productId === product.productId)
        ? prev.filter((p) => p.productId !== product.productId)
        : [...prev, product],
    )
  }

  const addSelectedToOrder = () => {
    const newItems: OrderItemWithStock[] = selectedProducts.map((p) => ({
      productId: p.productId,
      productName: p.name,
      sku: p.sku,
      quantity: 1,
      stockQuantity: p.stockQuantity,
      unitPrice: p.price,
      totalPrice: p.price,
    }))

    setOrderItems((prev) => [...prev, ...newItems])
    setSelectedProducts([])
    setIsDropdownOpen(false)
    setSearchTerm('')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERS - Order Items Management
  // ═══════════════════════════════════════════════════════════════════════════
  const updateItemQuantity = (productId: string, newQty: number) => {
    const qty = Math.max(1, newQty)
    setOrderItems((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, quantity: qty, totalPrice: qty * item.unitPrice }
          : item,
      ),
    )
  }

  const updateItemPrice = (productId: string, newPriceRaw: string) => {
    const numericPrice = newPriceRaw === '' ? 0 : parseFloat(newPriceRaw) || 0

    setOrderItems((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? {
              ...item,
              unitPrice: newPriceRaw as any,
              totalPrice: item.quantity * numericPrice,
            }
          : item,
      ),
    )
  }

  const removeItem = (index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index))
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERS - Form Submission
  // ═════════════════════════════════════════════════════════════════════════════════
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (orderItems.length === 0) {
      alert('Додайте хоча б один товар до замовлення')
      return
    }

    if (!formData.clientPhone) {
      alert('Введіть номер телефону клієнта')
      return
    }

    //Check for insufficient inventory
    const itemsWithInsufficientStock = orderItems.filter(
      (item) => item.quantity > item.stockQuantity,
    )

    if (itemsWithInsufficientStock.length > 0) {
      // Build error message for toast
      /* console.log('itemsWithInsufficientStock: ', itemsWithInsufficientStock) */

      const errorDetails = itemsWithInsufficientStock
        .map(
          (item) =>
            `${item.productName} (${item.sku}): обрано ${item.quantity}, але на складі лише ${item.stockQuantity}`,
        )
        .join(' | ')

      showToast('Недостатньо товару на складі: ' + errorDetails, 'error')
      return
    }

    try {
      // Strip stockQuantity before sending to API — it's a UI-only field
      const payload: CreateCRMOrderInput = {
        ...formData,
        items: orderItems.map(({ stockQuantity: _s, ...rest }) => rest),
      }
      console.log('Submitting order with data: ', payload)
      const result = await createOrder(payload).unwrap()

      showToast(`Замовлення створено успішно! ID: ${result.orderId}`, 'success')
      router.push('/orders')
    } catch (error: any) {
      console.error('Failed to create order:', error)
      showToast(
        `Помилка створення замовлення: ${error.data?.message || 'Невідома помилка'}`,
        'error',
      )
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
    }).format(amount)
  }

  //Check if an item has insufficient stock
  const hasInsufficientStock = (item: OrderItemWithStock) => {
    return item.stockQuantity === 0 || item.quantity > item.stockQuantity
  }

  /**
   * Normalize phone number for search by removing spaces and common separators
   * Examples:
   * "063 579 0251" -> "0635790251"
   * "+380 63 579 02 51" -> "+380635790251"
   * "063-579-0251" -> "0635790251"
   */
  const normalizePhoneForSearch = (phone: string): string => {
    // Remove spaces, hyphens, parentheses, and dots
    return phone.replace(/[\s\-()\.]/g, '')
  }

  // Selected NP address display label
  const selectedNpAddress = selectedNpAddressId
    ? npAddresses.find((a) => a.addressId === selectedNpAddressId)
    : null
  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className='p-6 bg-gray-50 min-h-screen'>
      <div className='max-w-4xl mx-auto'>
        {/* Header */}
        <div className='mb-6'>
          <h1 className='text-3xl font-bold text-gray-900 mb-2'>
            Створити замовлення
          </h1>

          {/* Prefill banner */}
          {isPrefilled && (
            <div className='flex items-center gap-2 mt-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 w-fit'>
              <Copy size={15} />
              Дані скопійовано з попереднього замовлення. Перевірте та
              відредагуйте за потреби.
            </div>
          )}
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
                          const isChecked = selectedProducts.some(
                            (p) => p.productId === product.productId,
                          )

                          return (
                            <div
                              key={product.productId}
                              className={`flex items-start gap-3 p-3 border-b border-gray-100 last:border-0 transition-colors cursor-pointer ${isChecked ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
                              onClick={() => toggleProductSelection(product)}
                            >
                              <div className='pt-1'>
                                <input
                                  type='checkbox'
                                  checked={isChecked}
                                  onChange={() => {}}
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
              {orderItems.map((item, index) => {
                const isOutOfStock = hasInsufficientStock(item)

                return (
                  <div
                    key={item.productId}
                    className={`flex flex-wrap md:flex-nowrap items-center gap-4 p-3 border rounded-lg  shadow-sm ${
                      isOutOfStock
                        ? 'bg-red-50 border-red-200'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    {/* Name and Stock Info */}
                    <div className='flex-1 min-w-[250px]'>
                      <div className='flex items-center gap-2'>
                        {isOutOfStock && (
                          <AlertTriangle className='w-4 h-4 text-red-500 flex-shrink-0' />
                        )}
                        <p
                          className={`text-sm font-medium leading-tight ${
                            isOutOfStock ? 'text-red-700' : 'text-blue-600'
                          }`}
                        >
                          {item.productName}
                          <span className='text-gray-400 ml-1 font-normal text-xs'>
                            {item.sku}
                          </span>
                        </p>
                      </div>
                      <p
                        className={`text-[11px] mt-0.5 ${
                          isOutOfStock
                            ? 'text-red-600 font-bold'
                            : 'text-gray-500'
                        }`}
                      >
                        {item.stockQuantity === 0
                          ? 'Немає на складі!'
                          : `(доступно ${item.stockQuantity} шт)`}
                      </p>
                    </div>

                    {/* Quantity Controls */}
                    <div className='flex items-center gap-1'>
                      <button
                        type='button'
                        onClick={() =>
                          updateItemQuantity(item.productId!, item.quantity - 1)
                        }
                        className='text-red-400 hover:text-red-600 transition-colors cursor-pointer'
                      >
                        <CircleMinus size={22} strokeWidth={2.5} />
                      </button>
                      <div className='flex items-center border border-gray-300 rounded px-2 py-1 bg-white'>
                        <input
                          type='number'
                          value={item.quantity}
                          onFocus={(e) => e.target.select()} // Selects the number on click for easy overwriting
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
                        className='text-green-500 hover:text-green-600 transition-colors cursor-pointer'
                      >
                        <CirclePlus size={22} strokeWidth={2.5} />
                      </button>
                    </div>

                    <div className='flex items-center border border-gray-300 rounded px-2 py-1 bg-white min-w-[100px]'>
                      <input
                        type='number'
                        value={item.unitPrice}
                        onFocus={(e) => e.target.select()} // Auto-selects 0 when clicked
                        onChange={(e) =>
                          updateItemPrice(
                            item.productId!,
                            e.target.value, // Pass raw string
                          )
                        }
                        className='w-full text-right text-sm font-semibold focus:outline-none'
                      />
                      <span className='text-[10px] text-gray-400 font-medium ml-1'>
                        грн.
                      </span>
                    </div>

                    <div className='flex items-center gap-2 min-w-[120px] justify-end'>
                      <ChevronDown size={14} className='text-blue-500' />
                      <span className='text-sm font-bold text-gray-700'>
                        {(item.totalPrice || 0).toFixed(2)} грн.
                      </span>
                    </div>

                    <button
                      type='button'
                      onClick={() => removeItem(index)}
                      className='text-blue-500 hover:text-red-500 p-1 transition-colors cursor-pointer'
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )
              })}

              {orderItems.length > 0 && (
                <div className='text-right pt-2 text-gray-700 font-bold'>
                  Усього: {orderItems.length} найм. (
                  {orderItems.reduce((a, b) => a + b.quantity, 0)} од.)
                </div>
              )}
            </div>
          </div>

          {/* Client Information with Dropdown */}
          <div className='bg-white rounded-lg shadow-sm p-6'>
            <h2 className='text-xl font-semibold text-gray-900 mb-4'>
              Інформація про клієнта
            </h2>

            {/* Client Search Dropdown */}
            <div className='relative mb-4'>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                Оберіть клієнта
              </label>
              <div
                className={`flex items-center border rounded-lg px-3 py-2.5 transition-all ${
                  isClientDropdownOpen
                    ? 'border-blue-500 ring-2 ring-blue-100'
                    : 'border-gray-300'
                }`}
              >
                <Search size={18} className='text-gray-400 mr-2' />
                <input
                  type='text'
                  className='w-full outline-none text-gray-700 bg-transparent'
                  placeholder='Пошук по імені або телефону...'
                  value={clientSearchTerm}
                  onFocus={() => setIsClientDropdownOpen(true)}
                  onChange={(e) => {
                    const rawValue = e.target.value
                    setClientSearchTerm(rawValue)
                  }}
                  onPaste={(e) => {
                    // On paste, normalize phone numbers by removing spaces
                    const pastedText = e.clipboardData.getData('text')
                    const normalized = normalizePhoneForSearch(pastedText)

                    // Only update if it looks like a phone number (mostly digits)
                    const digitCount = normalized.replace(/\D/g, '').length
                    if (digitCount >= 9) {
                      // This looks like a phone number - use normalized version
                      e.preventDefault()
                      setClientSearchTerm(normalized)
                    }
                    // Otherwise let the default paste behavior happen
                  }}
                />
                {isClientFetching ? (
                  <Loader2
                    size={18}
                    className='text-blue-500 animate-spin mr-2'
                  />
                ) : (
                  <ChevronDown
                    size={18}
                    className='text-gray-400 cursor-pointer'
                    onClick={() =>
                      setIsClientDropdownOpen(!isClientDropdownOpen)
                    }
                  />
                )}
              </div>

              {/* Client Dropdown */}
              {isClientDropdownOpen && (
                <>
                  <div
                    className='fixed inset-0 z-40'
                    onClick={() => setIsClientDropdownOpen(false)}
                  ></div>
                  <div className='absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-80 overflow-hidden flex flex-col'>
                    <div className='overflow-y-auto flex-1'>
                      {/* If client is selected, show the selected client */}
                      {selectedClient ? (
                        <div
                          className='flex items-center gap-3 p-3 border-b border-gray-100 bg-blue-50 cursor-pointer transition-colors'
                          onClick={() => handleClientSelect(selectedClient)}
                        >
                          <div className='flex-1'>
                            <p className='text-sm font-medium text-gray-900'>
                              {selectedClient.lastName}{' '}
                              {selectedClient.firstName}{' '}
                              {selectedClient.secondName || ''}
                            </p>
                            <p className='text-xs text-gray-500'>
                              {selectedClient.phone}
                              {selectedClient.email &&
                                ` • ${selectedClient.email}`}
                            </p>
                          </div>
                          <span className='text-xs bg-blue-600 text-white px-2 py-1 rounded'>
                            Обрано
                          </span>
                        </div>
                      ) : clients.length > 0 ? (
                        clients.map((client) => (
                          <div
                            key={client.clientId}
                            className='flex items-center gap-3 p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors'
                            onClick={() => handleClientSelect(client)}
                          >
                            <div className='flex-1'>
                              <p className='text-sm font-medium text-gray-900'>
                                {client.lastName} {client.firstName}{' '}
                                {client.secondName || ''}
                              </p>
                              <p className='text-xs text-gray-500'>
                                {client.phone}
                                {client.email && ` • ${client.email}`}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : debouncedClientSearch.length >= 3 ? (
                        <div className='p-4 text-center'>
                          <p className='text-sm text-gray-500 mb-3'>
                            Клієнта не знайдено
                          </p>
                          <button
                            type='button'
                            onClick={handleCreateNewClient}
                            className='flex items-center gap-2 mx-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm'
                          >
                            <UserPlus size={16} />
                            Створити: {clientSearchTerm}
                          </button>
                        </div>
                      ) : (
                        <div className='p-4 text-center text-sm text-gray-500'>
                          Введіть мінімум 3 символи для пошуку
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Client Details Form */}
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
                    handleManualClientChange('clientLastName', e.target.value)
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
                    handleManualClientChange('clientFirstName', e.target.value)
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
                    handleManualClientChange('clientSecondName', e.target.value)
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
                    handleManualClientChange('clientPhone', e.target.value)
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
                    handleManualClientChange('clientEmail', e.target.value)
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
                  onChange={(e) => {
                    handleInputChange('deliveryOptionName', e.target.value)
                    // Reset NP state if switching away from NovaPoshta
                    if (e.target.value !== 'NovaPoshta') {
                      setNpCityQuery('')
                      setNpCityRef('')
                      setNpWarehouseQuery('')
                    }
                  }}
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'
                >
                  <option value=''>Оберіть спосіб</option>
                  <option value='NovaPoshta'>Нова Пошта</option>
                  <option value='UkrPoshta'>Укрпошта</option>
                </select>
              </div>

              {/* ── Nova Poshta autocomplete fields ── */}
              {formData.deliveryOptionName === 'NovaPoshta' ? (
                <>
                  {/* ── Saved NP address picker (shown only when client is selected) ── */}
                  {selectedClient && (
                    <div className='md:col-span-2' ref={npAddressDropdownRef}>
                      <label className='block text-sm font-medium text-gray-700 mb-1'>
                        Адреса клієнта
                      </label>
                      <div className='relative'>
                        {/* Trigger button — mirrors the look from the screenshots */}
                        <button
                          type='button'
                          onClick={() => setIsNpAddressDropdownOpen((v) => !v)}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 border rounded-lg text-left text-sm transition-all ${
                            isNpAddressDropdownOpen
                              ? 'border-blue-500 ring-2 ring-blue-100'
                              : 'border-gray-300'
                          } bg-white`}
                        >
                          <MapPin
                            size={15}
                            className='text-gray-400 shrink-0'
                          />
                          <span
                            className={`flex-1 truncate ${selectedNpAddress ? 'text-gray-800' : 'text-gray-400'}`}
                          >
                            {selectedNpAddress
                              ? selectedNpAddress.address
                              : 'Оберіть збережену адресу або введіть нову'}
                          </span>
                          <ChevronDown
                            size={15}
                            className={`text-gray-400 shrink-0 transition-transform ${isNpAddressDropdownOpen ? 'rotate-180' : ''}`}
                          />
                        </button>

                        {isNpAddressDropdownOpen && (
                          <div className='absolute z-[200] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden'>
                            {/* Add new address row */}
                            <button
                              type='button'
                              onClick={() => {
                                setIsNpAddressDropdownOpen(false)
                                setShowAddAddressModal(true)
                              }}
                              className='w-full flex items-center gap-2 px-4 py-3 text-left text-sm text-blue-600 font-medium hover:bg-blue-50 border-b border-gray-200 transition-colors'
                            >
                              <Plus size={15} />
                              Додати адресу доставки
                            </button>

                            {/* Existing addresses */}
                            {npAddresses.length > 0 ? (
                              npAddresses.map((address) => {
                                const isSelected =
                                  selectedNpAddressId === address.addressId
                                return (
                                  <button
                                    key={address.addressId}
                                    type='button'
                                    onClick={() =>
                                      handleNpSavedAddressSelect(address)
                                    }
                                    className={`w-full flex items-start gap-3 px-4 py-3 text-left text-sm border-b border-gray-100 last:border-0 transition-colors ${
                                      isSelected
                                        ? 'bg-blue-600 text-white'
                                        : 'hover:bg-gray-50 text-gray-800'
                                    }`}
                                  >
                                    <MapPin
                                      size={14}
                                      className={`mt-0.5 shrink-0 ${isSelected ? 'text-blue-200' : 'text-gray-400'}`}
                                    />
                                    <div className='flex-1 min-w-0'>
                                      <p className='font-medium leading-snug break-words'>
                                        {address.address}
                                      </p>
                                      {address.branchNumber && (
                                        <p
                                          className={`text-xs mt-0.5 ${isSelected ? 'text-blue-200' : 'text-gray-500'}`}
                                        >
                                          {address.branchNumber}
                                        </p>
                                      )}
                                    </div>
                                    {address.isPrimary && (
                                      <span
                                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                                          isSelected
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-green-100 text-green-700'
                                        }`}
                                      >
                                        Основна
                                      </span>
                                    )}
                                  </button>
                                )
                              })
                            ) : (
                              <div className='px-4 py-3 text-sm text-gray-500 text-center'>
                                Немає збережених адрес Нової Пошти
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {/* City search */}
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Місто
                    </label>
                    <NpCitySearch
                      value={npCityQuery}
                      onChange={setNpCityQuery}
                      onSelect={handleNpCitySelect}
                      placeholder='Введіть назву міста...'
                    />
                  </div>

                  {/* Warehouse search — full width */}
                  <div className='md:col-span-2'>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Номер відділення
                    </label>
                    <NpWarehouseSearch
                      cityRef={npCityRef}
                      value={npWarehouseQuery}
                      onChange={setNpWarehouseQuery}
                      onSelect={handleNpWarehouseSelect}
                      placeholder='Введіть номер або адресу відділення...'
                    />
                    {/* Show resulting deliveryAddress as a subtle hint */}
                    {formData.deliveryAddress && (
                      <p className='mt-1.5 text-xs text-gray-500 pl-1'>
                        Буде збережено:{' '}
                        <span className='font-medium text-gray-700'>
                          {formData.deliveryAddress}
                        </span>
                      </p>
                    )}
                  </div>
                </>
              ) : (
                /* Manual address field for UkrPoshta or no selection */
                <>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Місто
                    </label>
                    <input
                      type='text'
                      value={formData.deliveryAddress?.split(',')[0] || ''}
                      onChange={(e) =>
                        handleInputChange('deliveryAddress', e.target.value)
                      }
                      className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'
                      placeholder='Київ'
                    />
                  </div>
                  <div className='md:col-span-2'>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Адреса
                    </label>
                    {selectedClient ? (
                      <div className='relative'>
                        <input
                          type='text'
                          value={formData.deliveryAddress}
                          onChange={(e) =>
                            handleInputChange('deliveryAddress', e.target.value)
                          }
                          onFocus={() => setIsAddressDropdownOpen(true)}
                          className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'
                          placeholder='Виберіть адресу зі списку'
                        />
                        {isAddressDropdownOpen && (
                          <>
                            <div
                              className='fixed inset-0 z-40'
                              onClick={() => setIsAddressDropdownOpen(false)}
                            />
                            <div className='absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto'>
                              <button
                                type='button'
                                onClick={() => {
                                  setShowAddAddressModal(true)
                                  setIsAddressDropdownOpen(false)
                                }}
                                className='w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-200 transition-colors text-blue-600 font-medium cursor-pointer'
                              >
                                <span className='text-lg'>+</span>
                                Додати адресу доставки
                              </button>
                              {clientAddresses && clientAddresses.length > 0 ? (
                                clientAddresses.map((address) => (
                                  <button
                                    key={address.addressId}
                                    type='button'
                                    onClick={() => handleAddressSelect(address)}
                                    className='w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors cursor-pointer'
                                  >
                                    <div className='flex-1'>
                                      <p className='text-sm font-medium text-gray-900'>
                                        {address.address}
                                      </p>
                                      {address.branchNumber && (
                                        <p className='text-xs text-gray-500 mt-0.5'>
                                          {address.branchNumber}
                                        </p>
                                      )}
                                    </div>
                                    {address.isPrimary && (
                                      <span className='text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full'>
                                        Основна
                                      </span>
                                    )}
                                  </button>
                                ))
                              ) : (
                                <div className='px-4 py-3 text-sm text-gray-500 text-center'>
                                  Немає збережених адрес
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <input
                        type='text'
                        value={formData.deliveryAddress}
                        onChange={(e) =>
                          handleInputChange('deliveryAddress', e.target.value)
                        }
                        className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'
                        placeholder='Відділення №1 або адреса доставки'
                      />
                    )}
                  </div>
                </>
              )}

              {/* Payment */}
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
                  {PAYMENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
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
                disabled={isLoading || orderItems.length === 0}
                className='flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
              >
                <Save size={20} />
                {isLoading ? 'Створення...' : 'Створити замовлення'}
              </button>
              <button
                type='button'
                onClick={() => router.push('/orders')}
                className='px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors'
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </form>
        {showAddAddressModal && selectedClient && (
          <AddAddressModal
            clientId={selectedClient.clientId}
            clientName={`${selectedClient.lastName} ${selectedClient.firstName}`}
            onClose={() => setShowAddAddressModal(false)}
            onSuccess={handleNewAddressAdded}
          />
        )}
      </div>
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
        duration={10000}
      />
    </div>
  )
}

export default CreateOrderPage
