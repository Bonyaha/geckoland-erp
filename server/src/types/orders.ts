//server/src/types/orders.ts

/**
 * ============================================
 * SHARED ORDER TYPES
 * ============================================
 * Centralized type definitions for internal ERP order domain
 * (NOT marketplace API types)
 */

/**
 * Internal tracking info used when syncing marketplace orders
 */
export interface OrderSyncTracking {
  productId: string
  orderedQuantity: number
}

/**
 * Basic order filter options used by controllers/services
 */
export interface OrderFilterParams {
  page?: number
  limit?: number
  source?: string
  status?: string
  dateFrom?: string
  dateTo?: string
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

/**
 * Standardized response shape for order lists
 */
export interface OrderListResponse<T> {
  data: T[]
  meta: PaginationMeta
}

/**
 * Minimal internal representation of an order item
 * (independent from Prom/Rozetka models)
 */
export interface UnifiedOrderItem {
  productId: string | null
  name: string
  quantity: number
  price: number
  total: number
  externalSku?: string
}

/**
 * Unified internal representation of a marketplace order
 * After being transformed from Prom/Rozetka models
 */
export interface UnifiedOrder {
  externalId: string
  source: 'prom' | 'rozetka'
  orderNumber?: string
  status: string
  createdAt: string
  updatedAt?: string
  phone?: string
  email?: string
  customerName?: string
  comment?: string
  deliveryAddress?: string
  trackingNumber?: string
  items: UnifiedOrderItem[]
}
