// client/src/state/api.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export interface Product {
  productId: string
  mainImage: string
  name: string
  price: number
  rating?: number
  stockQuantity: number
  sku: string
  costPrice?: number
}

export interface ProductInventoryStats {
  totalGoods: number
  inStockCount: number
  totalUnits: number
  totalValue: number
  potentialProfit: number
}

export interface NewProduct {
  name: string
  price: number
  rating?: number
  stockQuantity: number
  sku: string
}

export interface UpdateProduct {
  productId: string
  quantity?: number
  price?: number
  costPrice?: number
  targetMarketplace?: 'prom' | 'rozetka' | 'all'
}

export interface BatchUpdateProductQuantity {
  products: Array<{
    productId: string
    updates: {
      quantity?: number
      price?: number
    }
  }>
  targetMarketplace?: 'prom' | 'rozetka' | 'all'
}

export interface ProductsResponse {
  products: Product[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface ProductQueryParams {
  search?: string
  page?: number
  limit?: number
  stockFilter?: 'all' | 'inStock' | 'outOfStock'
}

export interface SyncMarketplacesResult {
  success: boolean
  productsCreatedFromProm: number
  productsCreatedFromRozetka: number
  totalCreated: number
  errors: string[]
}

export interface ProductSalesData {
  productId: string
  totalQuantitySold: number
  totalRevenue: number
  salesCount: number
  lastSaleDate?: string
}

export interface ProductSalesMap {
  [productId: string]: ProductSalesData
}

export interface GetProductSalesParams {
  productIds: string[]
  startDate?: string
}

export interface SalesSummary {
  salesSummaryId: string
  totalValue: number
  changePercentage?: number
  date: string
}

export interface PurchaseSummary {
  purchaseSummaryId: string
  totalPurchased: number
  changePercentage?: number
  date: string
}

export interface ExpenseSummary {
  expenseSummarId: string
  totalExpenses: number
  date: string
}

export interface ExpenseByCategorySummary {
  expenseByCategorySummaryId: string
  category: string
  amount: string
  date: string
}

export interface DashboardMetrics {
  popularProducts: Product[]
  salesSummary: SalesSummary[]
  purchaseSummary: PurchaseSummary[]
  expenseSummary: ExpenseSummary[]
  expenseByCategorySummary: ExpenseByCategorySummary[]
}

export interface User {
  userId: string
  name: string
  email: string
}

// ================================
//        ORDERS TYPES
// ================================

export type OrderSource = 'prom' | 'rozetka' | 'crm'

export type OrderStatus =
  | 'RECEIVED'
  | 'PREPARED'
  | 'SHIPPED'
  | 'AWAITING_PICKUP'
  | 'DELIVERED'
  | 'CANCELED'
  | 'RETURN'

export type DeliveryOption = 'NovaPoshta' | 'UkrPoshta'

export type PaymentOption =
  | 'ApplePay'
  | 'GooglePay'
  | 'RozetkaPay'
  | 'IBAN'
  | 'PromPayment'
  | 'CashOnDelivery'

export type PaymentStatus = 'PAID' | 'UNPAID' | 'PART_PAID' | 'CANCELLED'

export interface OrderItem {
  orderItemId: string
  productId?: string
  sku?: string
  productName: string
  productImage?: string
  productUrl?: string
  quantity: number
  unitPrice: number
  totalPrice: number
  measureUnit?: string
}

export interface Order {
  orderId: string
  externalOrderId: string
  source: OrderSource
  orderNumber?: string
  createdAt: string
  updatedAt: string
  lastModified?: string

  // Client info
  clientId?: string
  clientFirstName: string
  clientLastName: string
  clientSecondName?: string
  clientPhone: string
  clientEmail?: string
  clientFullName?: string

  // Recipient info
  recipientFirstName?: string
  recipientLastName?: string
  recipientSecondName?: string
  recipientPhone?: string
  recipientFullName?: string

  // Delivery
  deliveryOptionName?: DeliveryOption
  deliveryAddress?: string
  deliveryCity?: string
  trackingNumber?: string
  deliveryCost?: number

  // Payment
  paymentOptionName?: PaymentOption
  paymentStatus?: PaymentStatus

  // Financial
  totalAmount: number
  totalAmountWithDiscount?: number
  fullPrice?: number
  currency: string

  // Order details
  totalQuantity?: number
  itemCount: number
  status: OrderStatus
  statusName?: string

  // Additional
  clientNotes?: string
  sellerComment?: string
  orderSource?: string

  // Relations
  orderItems: OrderItem[]
}

export interface OrdersResponse {
  success: boolean
  data: {
    orders: Order[]
    pagination: {
      page: number
      limit: number
      total: number
      pages: number
    }
  }
}

export interface OrderQueryParams {
  page?: number
  limit?: number
  source?: OrderSource
  status?: OrderStatus | string
  dateFrom?: string
  dateTo?: string
}

export interface CreateCRMOrderInput {
  // Client info
  clientFirstName: string
  clientLastName: string
  clientSecondName?: string
  clientPhone: string
  clientEmail?: string

  // Recipient info (optional)
  recipientFirstName?: string
  recipientLastName?: string
  recipientSecondName?: string
  recipientPhone?: string

  // Delivery
  deliveryAddress?: string
  deliveryCity?: string
  deliveryOptionName?: string
  deliveryCost?: number

  // Payment
  paymentOptionName?: string

  // Order details
  items: Array<{
    productId?: string
    sku?: string
    productName: string
    quantity: number
    unitPrice: number
    totalPrice?: number
    measureUnit?: string
  }>
  totalAmount: number
  currency?: string
  clientNotes?: string
  status?: string
}

export interface UpdateOrderInput {
  // Status & tracking
  status?: OrderStatus
  statusName?: string
  trackingNumber?: string

  // Delivery
  deliveryAddress?: string
  deliveryCity?: string
  deliveryOptionName?: DeliveryOption
  deliveryCost?: number

  // Payment
  paymentOptionName?: PaymentOption
  paymentStatus?: PaymentStatus

  // Client info — now fully editable
  clientFirstName?: string
  clientLastName?: string
  clientSecondName?: string
  clientPhone?: string
  clientEmail?: string

  // Notes
  clientNotes?: string
  sellerComment?: string

  // Items — full replacement list
  items?: Array<{
    orderItemId?: string
    productId?: string | null
    productName: string
    sku?: string | null
    quantity: number
    unitPrice: number
    totalPrice?: number
  }>
}

export interface OrderSyncResult {
  created: number
  skipped: number
  errors: number
}

export interface OrderCheckSummary {
  prom: OrderSyncResult
  rozetka: OrderSyncResult
  totals: {
    created: number
    skipped: number
    errors: number
  }
}

export interface SyncPaymentStatusesResult {
  checked: number
  updated: number
  errors: number
  updatedOrders: Array<{
    orderId: string
    orderNumber: string
    before: string
    after: string
  }>
}

// ================================
//        CLIENT TYPES
// ================================

export interface Client {
  clientId: string
  firstName: string
  lastName: string
  secondName?: string
  phone: string
  email?: string
  address?: string
  deliveryOptionName?: string
  paymentOptionName?: string
  reliability?: string
  totalOrders: number
  totalSpent: number
  createdAt: string
  updatedAt: string
}

export interface ClientsResponse {
  success: boolean
  data: {
    clients: Client[]
    pagination: {
      page: number
      limit: number
      total: number
      pages: number
    }
  }
}

export interface CreateClientInput {
  firstName: string
  lastName: string
  secondName?: string
  phone: string
  email?: string
  address?: string
  deliveryOptionName?: string
  paymentOptionName?: string
  reliability?: string
}

export interface GetOrCreateClientResponse {
  success: boolean
  data: Client
}

export const api = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL }),
  reducerPath: 'api',
  tagTypes: [
    'DashboardMetrics',
    'Products',
    'Users',
    'Expenses',
    'Sales',
    'Orders',
    'Clients',
  ],
  endpoints: (build) => ({
    getDashboardMetrics: build.query<DashboardMetrics, void>({
      query: () => '/dashboard',
      providesTags: ['DashboardMetrics'],
    }),
    getProducts: build.query<ProductsResponse, ProductQueryParams | void>({
      query: (params) => ({
        url: '/products',
        params: params || {},
      }),
      providesTags: ['Products'],
    }),
    getProductStats: build.query<ProductInventoryStats, void>({
      query: () => '/products/stats',
      providesTags: ['Products'],
    }),
    getProductsSales: build.query<ProductSalesMap, GetProductSalesParams>({
      query: ({ productIds, startDate }) => ({
        url: '/sales/products',
        method: 'POST',
        body: { productIds, startDate },
      }),
      providesTags: ['Sales'],
    }),
    createProduct: build.mutation<Product, NewProduct>({
      query: (newProduct) => ({
        url: '/products',
        method: 'POST',
        body: newProduct,
      }),
      invalidatesTags: ['Products'],
    }),
    updateProduct: build.mutation<Product, UpdateProduct>({
      query: ({
        productId,
        quantity,
        price,
        costPrice,
        targetMarketplace,
      }) => ({
        url: `/products/${productId}`,
        method: 'PATCH',
        body: {
          quantity,
          price,
          costPrice,
          targetMarketplace: targetMarketplace || 'all',
        },
      }),
      invalidatesTags: ['Products'],
    }),
    batchUpdateProduct: build.mutation<any, BatchUpdateProductQuantity>({
      query: ({ products, targetMarketplace }) => ({
        url: `/products/batch`,
        method: 'PATCH',
        body: {
          products,
          targetMarketplace: targetMarketplace || 'all',
        },
      }),
      invalidatesTags: ['Products'],
    }),
    syncProductsFromMarketplaces: build.mutation<SyncMarketplacesResult, void>({
      query: () => ({
        url: '/products/sync/marketplaces',
        method: 'POST',
      }),
      invalidatesTags: ['Products'],
    }),
    getUsers: build.query<User[], void>({
      query: () => '/users',
      providesTags: ['Users'],
    }),
    getExpensesByCategory: build.query<ExpenseByCategorySummary[], void>({
      query: () => '/expenses',
      providesTags: ['Expenses'],
    }),

    /* ORDERS ENDPOINTS */
    // Get all orders with filtering and pagination
    getOrders: build.query<OrdersResponse, OrderQueryParams | void>({
      query: (params) => ({
        url: '/orders',
        params: params || {},
      }),
      providesTags: ['Orders'],
    }),
    getOrderCounts: build.query<
      {
        success: boolean
        data: {
          all: number
          RECEIVED: number
          PREPARED: number
          SHIPPED: number
          AWAITING_PICKUP: number
          DELIVERED: number
          CANCELED: number
          RETURN: number
        }
      },
      void
    >({
      query: () => '/orders/counts',
      providesTags: ['Orders'],
    }),

    // Get specific order by ID
    getOrderById: build.query<{ success: boolean; data: Order }, string>({
      query: (orderId) => `/orders/${orderId}`,
      providesTags: (result, error, orderId) => [
        { type: 'Orders', id: orderId },
      ],
    }),

    // Create manual CRM order
    createCRMOrder: build.mutation<
      { orderId: string; message: string },
      CreateCRMOrderInput
    >({
      query: (orderData) => ({
        url: '/orders/create-crm',
        method: 'POST',
        body: orderData,
      }),
      invalidatesTags: ['Orders'],
    }),

    // Update existing order
    updateOrder: build.mutation<
      { success: boolean; data: Order },
      { orderId: string; updates: UpdateOrderInput }
    >({
      query: ({ orderId, updates }) => ({
        url: `/orders/${orderId}`,
        method: 'PATCH',
        body: updates,
      }),
      invalidatesTags: (result, error, { orderId }) => [
        'Orders',
        { type: 'Orders', id: orderId },
      ],
    }),
    fetchTrackingNumber: build.mutation<
      { success: boolean; message: string; data: any },
      string
    >({
      query: (orderId) => ({
        url: `/tracking/order/${orderId}`,
        method: 'PATCH',
        body: {}, // Empty body triggers marketplace fetch logic
      }),
      invalidatesTags: (result, error, orderId) => [
        { type: 'Orders', id: orderId },
        'Orders',
      ],
    }),
    updateAllTrackingStatuses: build.mutation<
      {
        success: boolean
        message: string
        updated: number
        total: number
        results: any[]
      },
      void
    >({
      query: () => ({
        url: '/tracking/update-all',
        method: 'POST',
      }),
      invalidatesTags: ['Orders'],
    }),

    // Fetch new orders from Prom
    fetchPromOrders: build.mutation<
      { success: boolean; message: string; data: OrderSyncResult },
      void
    >({
      query: () => ({
        url: '/orders/fetch/prom',
        method: 'POST',
      }),
      invalidatesTags: ['Orders'],
    }),

    // Sync orders from marketplaces
    syncOrders: build.mutation<
      { success: boolean; message: string; data: OrderSyncResult },
      { marketplace?: 'prom' | 'rozetka' }
    >({
      query: (body) => ({
        url: '/orders/sync',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Orders'],
    }),

    // Manual check for new orders
    checkForNewOrders: build.mutation<OrderCheckSummary, void>({
      query: () => ({
        url: '/orders/check-new',
        method: 'POST',
      }),
      invalidatesTags: ['Orders'],
    }),

    // Sync payment statuses for UNPAID orders
    syncPaymentStatuses: build.mutation<
      { success: boolean; message: string; data: SyncPaymentStatusesResult },
      void
    >({
      query: () => ({
        url: '/orders/sync-payment-statuses',
        method: 'POST',
      }),
      invalidatesTags: ['Orders'],
    }),

    deleteOrder: build.mutation<{ success: boolean; message: string }, string>({
      query: (orderId) => ({
        url: `/orders/${orderId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, orderId) => [
        'Orders',
        { type: 'Orders', id: orderId },
      ],
    }),

    //Client endpoints
    getClients: build.query<
      ClientsResponse,
      { search?: string; page?: number; limit?: number } | void
    >({
      query: (params) => ({
        url: '/clients',
        params: params || {},
      }),
      providesTags: ['Clients'],
    }),

    searchClientsAutocomplete: build.query<Client[], string>({
      query: (searchTerm) => ({
        url: '/clients',
        params: {
          search: searchTerm,
          limit: 10, // Limit results for dropdown
        },
      }),
      // Transform response to extract just the clients array
      transformResponse: (response: ClientsResponse) => response.data.clients,
      providesTags: ['Clients'],
    }),
  }),
})

export const {
  useGetDashboardMetricsQuery,
  useGetProductsQuery,
  useGetProductStatsQuery,
  useGetProductsSalesQuery,
  useCreateProductMutation,
  useGetUsersQuery,
  useGetExpensesByCategoryQuery,
  useUpdateProductMutation,
  useBatchUpdateProductMutation,
  useSyncProductsFromMarketplacesMutation,
  useGetOrdersQuery,
useGetOrderCountsQuery,
  useGetOrderByIdQuery,
  useCreateCRMOrderMutation,
  useUpdateOrderMutation,
  useFetchTrackingNumberMutation,
  useUpdateAllTrackingStatusesMutation,
  useFetchPromOrdersMutation,
  useSyncOrdersMutation,
  useCheckForNewOrdersMutation,
  useSyncPaymentStatusesMutation,
  useDeleteOrderMutation,
  useGetClientsQuery,
  useSearchClientsAutocompleteQuery,
} = api
