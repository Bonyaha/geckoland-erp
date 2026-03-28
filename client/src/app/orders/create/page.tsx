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
  Pencil,
  MapPin,
} from 'lucide-react'

import { useToast } from '@/hooks/useToast'
import Toast from '@/app/(components)/Toast'

import { AddAddressModal } from '../(components)'

import { PAYMENT_OPTIONS } from '@/utils/marketplaceUtils'

import {
  NpCitySearch,
  NpWarehouseSearch,
} from '@/app/(components)/NovaPoshtaSearch'
import type { NpCity } from '@/hooks/useNovaPoshtaAutocomplete'

type OrderItemWithStock = NonNullable<CreateCRMOrderInput['items']>[number] & {
  stockQuantity: number
}

// Tracks whether the delivery address came from the saved-address picker
// or was entered manually (including via Nova Poshta autocomplete).
type AddressSource = 'saved' | 'manual'

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
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'UNPAID'>(
    'UNPAID',
  )
const [orderSource, setOrderSource] = useState<string>('telegram')

  // ─── NP Autocomplete State ───────────────────────────────────────────────────
  // Stores the city display string typed by the user
  const [npCityQuery, setNpCityQuery] = useState('')
  // Stores the DeliveryCity ref returned by Nova Poshta (needed for warehouse lookup)
  const [npCityRef, setNpCityRef] = useState('')
  // Stores the warehouse display string typed by the user
  const [npWarehouseQuery, setNpWarehouseQuery] = useState('')

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
  const [isClientSearchFocused, setIsClientSearchFocused] = useState(false)
  // Track if user is in "pending" mode - started editing but hasn't confirmed
  const [isPendingClientEdit, setIsPendingClientEdit] = useState(false)
  // Store backup of client data to restore if user cancels editing
  const [pendingClientData, setPendingClientData] = useState<{
    client: Client | null
    formData: typeof formData
    savedAddress: ClientAddress | null
    lastSavedAddress: ClientAddress | null
  } | null>(null)
  const [isAddressDropdownOpen, setIsAddressDropdownOpen] = useState(false)
  const [showAddAddressModal, setShowAddAddressModal] = useState(false)

  // which saved address is currently shown in the address pill
  const [selectedSavedAddress, setSelectedSavedAddress] =
    useState<ClientAddress | null>(null)

  // Remember the last saved address so we can restore it when the user
  // switches the delivery option back to the one that originally matched it.
  const [lastSavedAddress, setLastSavedAddress] =
    useState<ClientAddress | null>(null)

  // 'saved' = showing the address pill / dropdown; 'manual' = NP autocomplete or plain input
  const [addressSource, setAddressSource] = useState<AddressSource>('manual')

  // ref for the address dropdown so outside-clicks close it
  const addressDropdownRef = useRef<HTMLDivElement>(null)
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
  const { data: clientAddresses, refetch: refetchAddresses } =
    useGetClientAddressesQuery(selectedClient?.clientId || '', {
      skip: !selectedClient?.clientId,
    })

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED VALUES
  // ═══════════════════════════════════════════════════════════════════════════
  const products = productsData?.products || []
  const totalPages = productsData?.pagination?.pages || 1
  const clients = clientsData || []

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════

  // close address dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        addressDropdownRef.current &&
        !addressDropdownRef.current.contains(e.target as Node)
      ) {
        setIsAddressDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Prefill from sessionStorage (Copy Sale)
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

  // Reset to page 1 when searching products
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch])

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

  // Recalculate total amount whenever items change
  useEffect(() => {
    const total = orderItems.reduce(
      (sum, item) => sum + (item.totalPrice || 0),
      0,
    )
    setFormData((prev) => ({ ...prev, totalAmount: total }))
  }, [orderItems])

  // When addresses load for a freshly-selected client, auto-select the
  // primary address (or first one) so the delivery field is prefilled.
  useEffect(() => {
    if (!clientAddresses || clientAddresses.length === 0) return
    if (selectedSavedAddress) return // already chosen, don't overwrite
    const primary =
      clientAddresses.find((a) => a.isPrimary) ?? clientAddresses[0]
    if (primary) {
      applyAddressSelection(primary)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientAddresses])

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
setIsPendingClientEdit(false)
setPendingClientData(null)
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
    // reset address state so the auto-select effect can run
    setSelectedSavedAddress(null)
    setLastSavedAddress(null) //clear remembered address for new client
    setAddressSource('manual')
    setNpCityQuery('')
    setNpCityRef('')
    setNpWarehouseQuery('')
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

setIsPendingClientEdit(false)
setPendingClientData(null)
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
    // clear saved address when starting a new client from scratch
    setSelectedSavedAddress(null)
    setLastSavedAddress(null)
    setAddressSource('manual')
  }

  // HANDLERS - Address Selection

  // shared logic for applying a saved address to form state
  const applyAddressSelection = (address: ClientAddress) => {
    setSelectedSavedAddress(address)
    setLastSavedAddress(address) //remember this address for potential restoration
    setAddressSource('saved')
    setFormData((prev) => ({
      ...prev,
      deliveryAddress: address.address,
      deliveryOptionName: address.deliveryOptionName || prev.deliveryOptionName,
    }))
    // if saved address is Nova Poshta, pre-populate NP query fields too
    if (address.deliveryOptionName === 'NovaPoshta') {
      const parts = address.address.split(', ')
      setNpCityQuery(parts[0] || '')
      setNpCityRef('') // ref unknown from stored string; user can re-search
      setNpWarehouseQuery(parts.slice(1).join(', '))
    } else {
      setNpCityQuery('')
      setNpCityRef('')
      setNpWarehouseQuery('')
    }
  }

  const handleAddressSelect = (address: ClientAddress) => {
    applyAddressSelection(address)
    setIsAddressDropdownOpen(false)
  }

  // pencil button — switch back to manual / NP input mode
  const handleSwitchToManualAddress = () => {
    setSelectedSavedAddress(null)
    setAddressSource('manual')
    setFormData((prev) => ({ ...prev, deliveryAddress: '' }))
    setNpCityQuery('')
    setNpCityRef('')
    setNpWarehouseQuery('')
  }

  const handleNewAddressAdded = (address: {
    addressId: string
    address: string
    deliveryOptionName?: string | null
  }) => {
    // treat a newly-created address like a saved selection
    const synthetic: ClientAddress = {
      addressId: address.addressId,
      clientId: selectedClient?.clientId || '',
      address: address.address,
      deliveryOptionName: address.deliveryOptionName ?? null,
      branchNumber: null,
      isPrimary: false,
      createdAt: new Date().toISOString(),
    } as any
    applyAddressSelection(synthetic)
    refetchAddresses() // refresh so new address appears in the list
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
        paymentStatus,
        source: orderSource,
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

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className='p-6 bg-gray-50 min-h-screen'>
      <div className='max-w-4xl mx-auto'>
        {/* Header */}
        <div className='mb-6'>
          <h1 className='text-3xl font-bold text-gray-900 mb-2'>
            Нове замовлення
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
                  onFocus={() => {
                    setIsClientDropdownOpen(true)
                    // If a client is already selected, clicking the field should
                    // clear it so user can immediately type a new value without deleting
                    if (
                      selectedClient &&
                      !isClientSearchFocused &&
                      !isPendingClientEdit
                    ) {
                      // Save backup of current client data to restore if user cancels
                      setPendingClientData({
                        client: selectedClient,
                        formData: { ...formData },
                        savedAddress: selectedSavedAddress,
                        lastSavedAddress: lastSavedAddress,
                      })
                      setIsPendingClientEdit(true)
                      setClientSearchTerm('')
                      setDebouncedClientSearch('')
                    }
                    setIsClientSearchFocused(true)
                  }}
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
                  onBlur={() => {
                    // Reset focus state after a short delay to allow onClick on dropdown items
                    setTimeout(() => setIsClientSearchFocused(false), 200)
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
                    onClick={() => {
                      // If user clicks outside without confirming (not creating a new client),
                      // restore the previous client data
                      if (isPendingClientEdit && pendingClientData) {
                        setSelectedClient(pendingClientData.client)
                        setFormData(pendingClientData.formData)
                        setSelectedSavedAddress(pendingClientData.savedAddress)
                        setLastSavedAddress(pendingClientData.lastSavedAddress)
                        setClientSearchTerm(
                          pendingClientData.client
                            ? `${pendingClientData.client.lastName} ${pendingClientData.client.firstName} (${pendingClientData.client.phone})`
                            : '',
                        )
                        // Restore NP fields based on saved address
                        if (
                          pendingClientData.savedAddress?.deliveryOptionName ===
                          'NovaPoshta'
                        ) {
                          const parts =
                            pendingClientData.savedAddress.address.split(', ')
                          setNpCityQuery(parts[0] || '')
                          setNpCityRef('')
                          setNpWarehouseQuery(parts.slice(1).join(', '))
                        } else {
                          setNpCityQuery('')
                          setNpCityRef('')
                          setNpWarehouseQuery('')
                        }
                        // Determine address source based on whether we have saved address
                        setAddressSource(
                          pendingClientData.savedAddress ? 'saved' : 'manual',
                        )
                        setIsPendingClientEdit(false)
                        setPendingClientData(null)
                      }
                      setIsClientDropdownOpen(false)
                    }}
                  ></div>
                  <div className='absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-80 overflow-hidden flex flex-col'>
                    <div className='overflow-y-auto flex-1'>
                      {/* Reorganized logic to prioritize search results, but handle the selected client state gracefully to avoid "Not found" errors when a client is already picked. */}
                      {clients.length > 0 ? (
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
                            {/* NEW: Added indicator to highlight the already selected client within the search results list */}
                            {selectedClient?.clientId === client.clientId && (
                              <span className='text-xs bg-blue-600 text-white px-2 py-1 rounded'>
                                Обрано
                              </span>
                            )}
                          </div>
                        ))
                      ) : selectedClient &&
                        (debouncedClientSearch.length < 3 ||
                          clientSearchTerm ===
                            `${selectedClient.lastName} ${selectedClient.firstName} (${selectedClient.phone})`) ? (
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
                    const newDeliveryOption = e.target.value
                    handleInputChange('deliveryOptionName', newDeliveryOption)

                    //Use the currently-selected saved address OR the last
                    // remembered one so we can restore it if the user switches back.
                    const addressToCheck =
                      selectedSavedAddress ?? lastSavedAddress

                    if (addressToCheck) {
                      const savedOption =
                        addressToCheck.deliveryOptionName || ''
                      if (newDeliveryOption === savedOption) {
                        // User switched back to the delivery option that
                        // matches the saved address — restore it automatically.
                        applyAddressSelection(addressToCheck)
                      } else {
                        setSelectedSavedAddress(null)
                        setAddressSource('manual')
                        setFormData((prev) => ({
                          ...prev,
                          deliveryAddress: '',
                        }))
                        setNpCityQuery('')
                        setNpCityRef('')
                        setNpWarehouseQuery('')
                      }
                    } else {
                      // only reset NP fields when switching away from NovaPoshta.
                      if (newDeliveryOption !== 'NovaPoshta') {
                        setNpCityQuery('')
                        setNpCityRef('')
                        setNpWarehouseQuery('')
                      }
                    }
                  }}
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'
                >
                  <option value=''>Оберіть спосіб</option>
                  <option value='NovaPoshta'>Нова Пошта</option>
                  <option value='UkrPoshta'>Укрпошта</option>
                </select>
              </div>

              {/* ══════════════════════════════════════════════════════════════════════
                 Saved-address picker.
                  Visible when a client is selected AND they have saved addresses
                  AND the user hasn't clicked the pencil to switch to manual input.                  
                ══════════════════════════════════════════════════════════════════════ */}
              {selectedClient &&
                clientAddresses &&
                clientAddresses.length > 0 &&
                addressSource === 'saved' && (
                  <div className='md:col-span-2'>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Адреса доставки
                    </label>

                    <div className='flex items-center gap-2'>
                      {/* Address dropdown */}
                      <div ref={addressDropdownRef} className='relative flex-1'>
                        <button
                          type='button'
                          onClick={() => setIsAddressDropdownOpen((v) => !v)}
                          className={`w-full flex items-center justify-between border rounded-lg px-3 py-2.5 text-sm bg-white text-left transition-all ${
                            isAddressDropdownOpen
                              ? 'border-blue-500 ring-2 ring-blue-100'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <span
                            className={`truncate ${selectedSavedAddress ? 'text-gray-800' : 'text-gray-400'}`}
                          >
                            {selectedSavedAddress
                              ? selectedSavedAddress.address
                              : 'Оберіть адресу зі списку...'}
                          </span>
                          <ChevronDown
                            size={16}
                            className='text-gray-400 shrink-0 ml-2'
                          />
                        </button>

                        {/* Dropdown list */}
                        {isAddressDropdownOpen && (
                          <div className='absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto'>
                            {/* Add new address */}
                            <button
                              type='button'
                              onClick={() => {
                                setShowAddAddressModal(true)
                                setIsAddressDropdownOpen(false)
                              }}
                              className='w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-200 transition-colors text-blue-600 font-medium cursor-pointer text-sm'
                            >
                              <MapPin size={15} />
                              Додати адресу доставки
                            </button>

                            {/* Existing addresses */}
                            {clientAddresses.map((address) => (
                              <button
                                key={address.addressId}
                                type='button'
                                onClick={() => handleAddressSelect(address)}
                                className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-gray-100 last:border-0 transition-colors cursor-pointer text-sm ${
                                  selectedSavedAddress?.addressId ===
                                  address.addressId
                                    ? 'bg-blue-50'
                                    : 'hover:bg-gray-50'
                                }`}
                              >
                                <div className='flex-1'>
                                  <p className='font-medium text-gray-900 leading-tight'>
                                    {address.address}
                                  </p>
                                  {address.branchNumber && (
                                    <p className='text-xs text-gray-500 mt-0.5'>
                                      {address.branchNumber}
                                    </p>
                                  )}
                                  {address.deliveryOptionName && (
                                    <p className='text-xs text-gray-400 mt-0.5'>
                                      {address.deliveryOptionName}
                                    </p>
                                  )}
                                </div>
                                {address.isPrimary && (
                                  <span className='text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full shrink-0 mt-0.5'>
                                    Основна
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Pencil button — switch to manual / NP input */}
                      <button
                        type='button'
                        title='Ввести адресу вручну'
                        onClick={handleSwitchToManualAddress}
                        className='p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-500 hover:text-blue-600 shrink-0'
                      >
                        <Pencil size={16} />
                      </button>
                    </div>

                    {/* Hint showing what will be saved */}
                    {selectedSavedAddress && formData.deliveryAddress && (
                      <p className='mt-1.5 text-xs text-gray-500 pl-1'>
                        Буде збережено:{' '}
                        <span className='font-medium text-gray-700'>
                          {formData.deliveryAddress}
                        </span>
                      </p>
                    )}
                  </div>
                )}

              {/* ══════════════════════════════════════════════════════════════════════
                  Shown when:
                  • No client selected, OR
                  • Client has no saved addresses, OR
                  • User clicked the pencil (addressSource === 'manual')
                ══════════════════════════════════════════════════════════════════════ */}
              {(!selectedClient ||
                !clientAddresses ||
                clientAddresses.length === 0 ||
                addressSource === 'manual') && (
                <>
                  {formData.deliveryOptionName === 'NovaPoshta' ? (
                    <>
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
                    </>
                  )}
                </>
              )}

              </div>
          </div>

          {/* CHANGE: Separated payment into its own section */}
          {/* Оплата */}
          <div className='bg-white rounded-lg shadow-sm p-6'>
            <h2 className='text-xl font-semibold text-gray-900 mb-4'>
              Оплата
            </h2>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
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
                  {PAYMENT_OPTIONS.filter((o) =>
                    ['', 'IBAN', 'CashOnDelivery'].includes(o.value),
                  ).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Статус оплати
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) =>
                    setPaymentStatus(e.target.value as 'PAID' | 'UNPAID')
                  }
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'
                >
                  <option value='UNPAID'>Не оплачено</option>
                  <option value='PAID'>Оплачено</option>
                </select>
              </div>
            </div>
          </div>

          {/* NEW: Канал продажів section */}
          <div className='bg-white rounded-lg shadow-sm p-6'>
            <h2 className='text-xl font-semibold text-gray-900 mb-4'>
              Канал продажів
            </h2>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Джерело замовлення
                </label>
                <select
                  value={orderSource}
                  onChange={(e) => setOrderSource(e.target.value)}
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'
                >
                  <option value='crm'>CRM (вручну)</option>
                  <option value='telegram'>Telegram</option>
                  <option value='viber'>Viber</option>
                  <option value='instagram'>Instagram</option>
                  <option value='website'>Сайт</option>
                  <option value='olx'>OLX</option>
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
