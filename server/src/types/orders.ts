// server/src/types/orders.ts

import { OrderStatus, Source, Prisma } from '../config/database'
import { Decimal } from '@prisma/client/runtime/library'

/**
 * ============================================
 * ORDER DOMAIN TYPES
 * ============================================
 * Centralized type definitions for order management
 */

// ============================================
// BASIC ORDER TYPES
// ============================================

/**
 * Order filter parameters for queries
 */
export interface OrderFilterParams {
  page?: number
  limit?: number
  source?: Source
  status?: string | OrderStatus
  dateFrom?: string
  dateTo?: string
}

/**
 * Pagination metadata for order lists
 */
export interface OrderPaginationMeta {
  page: number
  limit: number
  total: number
  pages: number
}

/**
 * Standardized response for order list queries
 */
export interface OrderListResponse {
  orders: any[] // Use Prisma.OrdersGetPayload<{ include: { orderItems: true } }>[]
  pagination: OrderPaginationMeta
}

/**
 * Result of order sync operations (create/update from marketplaces)
 */
export interface OrderSyncResult {
  created: number
  skipped: number
  errors: number
}

/**
 * Summary of manual order check across all marketplaces
 */
export interface OrderCheckSummary {
  prom: OrderSyncResult
  rozetka: OrderSyncResult
  totals: {
    created: number
    skipped: number
    errors: number
  }
}

// ============================================
// ORDER CREATION TYPES
// ============================================

/**
 * Customer/Client information structure
 */
export interface OrderCustomerInfo {
  clientId?: string
  clientFirstName: string
  clientLastName: string
  clientSecondName?: string
  clientPhone: string
  clientEmail?: string
  clientFullName?: string
}

/**
 * Delivery recipient information (if different from customer)
 */
export interface OrderRecipientInfo {
  recipientFirstName?: string
  recipientLastName?: string
  recipientSecondName?: string
  recipientPhone?: string
  recipientFullName?: string
}

/**
 * Delivery information structure
 */
export interface OrderDeliveryInfo {
  deliveryOptionId?: number
  deliveryOptionName?: string
  deliveryAddress?: string
  deliveryCity?: string
  trackingNumber?: string
  deliveryCost?: Decimal | number
  deliveryProviderData?: any
}

/**
 * Payment information structure
 */
export interface OrderPaymentInfo {
  paymentOptionId?: number
  paymentOptionName?: string
  paymentData?: any
  paymentStatus?: string
}

/**
 * Financial information for orders
 */
export interface OrderFinancialInfo {
  totalAmount: Decimal | number
  totalAmountWithDiscount?: Decimal | number
  fullPrice?: Decimal | number
  currency: string
  deliveryCost?: Decimal | number
  cpaCommission?: Decimal | number
  prosaleCommission?: Decimal | number
  isCommissionRefunded?: boolean
}

/**
 * Order item structure for creation
 */
export interface OrderItemInput {
  orderItemId: string
  externalProductId: string
  productId?: string | null
  sku?: string | null
  productName: string
  productNameMultilang?: any
  productImage?: string | null
  productUrl?: string | null
  quantity: number
  unitPrice: Decimal | number
  totalPrice: Decimal | number
  measureUnit?: string | null
  cpaCommission?: Decimal | number | null
  rawItemData?: any
}

/**
 * Base order creation input (common fields across all sources)
 */
export interface BaseOrderCreateInput {
  orderId: string
  externalOrderId: string
  source: Source
  orderNumber?: string

  // Timestamps
  createdAt: Date
  lastModified?: Date | null

  // Customer info
  customer: OrderCustomerInfo

  // Delivery recipient (optional)
  recipient?: OrderRecipientInfo

  // Delivery info
  delivery: OrderDeliveryInfo

  // Payment info
  payment: OrderPaymentInfo

  // Financial info
  financial: OrderFinancialInfo

  // Order details
  itemCount: number
  totalQuantity?: number

  // Status
  status: OrderStatus
  statusName?: string | null
  statusGroup?: number | null

  // Additional info
  clientNotes?: string | null
  sellerComment?: string | null
  sellerComments?: any

  // Marketing data
  utmData?: any
  orderSource?: string | null

  // Flags
  dontCallCustomer?: boolean
  isViewed?: boolean
  isFulfillment?: boolean
  canCopy?: boolean

  // Special offers
  specialOfferData?: any

  // Raw data backup
  rawOrderData?: any

  // Order items
  orderItems: OrderItemInput[]
}

/**
 * CRM order creation input (from frontend)
 */
export interface CRMOrderItem {
  productId?: string
  sku?: string
  productName: string
  quantity: number
  unitPrice: number
  totalPrice?: number
  measureUnit?: string
  // Allow for additional dynamic fields without breaking type safety completely
  [key: string]: any
}

export interface CRMOrderCreateInput {
  // Client Info
  clientFirstName?: string
  clientLastName?: string
  clientSecondName?: string
  clientPhone?: string
  clientEmail?: string

  // Recipient Info
  recipientFirstName?: string
  recipientLastName?: string
  recipientSecondName?: string
  recipientPhone?: string

  // Delivery Info
  deliveryAddress?: string
  deliveryCity?: string
  deliveryOptionName?: string
  deliveryCost?: number | string

  // Payment & Financials
  paymentOptionName?: string
  totalAmount: number | string
  currency?: string

  // Order Meta
  notes?: string
  status?: OrderStatus

  // Items
  items: CRMOrderItem[]
}

// ============================================
// ORDER UPDATE TYPES
// ============================================

/**
 * Allowed fields for order updates
 */
export interface OrderUpdateInput {
  status?: OrderStatus
  statusName?: string
  trackingNumber?: string
  deliveryAddress?: string
  clientNotes?: string
  sellerComment?: string
  isViewed?: boolean
  lastModified?: Date
  // Add other updatable fields as needed
}

// ============================================
// ORDER ITEM TYPES
// ============================================

/**
 * Order item for inventory sync
 */
export interface OrderItemForSync {
  productId: string // App's internal product ID or SKU
  orderedQuantity: number
}

/**
 * Unified order item (marketplace-agnostic)
 */
export interface UnifiedOrderItem {
  productId?: string | null
  externalProductId: string
  sku?: string | null
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
  image?: string | null
  url?: string | null
}

// ============================================
// ORDER SERVICE TYPES
// ============================================

/**
 * Order service method result types
 */
export interface OrderCreationResult {
  orderId: string
  success: boolean
  message?: string
}

/**
 * Order query result with pagination
 */
export interface OrderQueryResult {
  orders: any[] // Prisma Orders with relations
  pagination: OrderPaginationMeta
}

/**
 * Order validation error
 */
export interface OrderValidationError {
  field: string
  message: string
  value?: any
}

// ============================================
// ORDER NORMALIZATION TYPES
// ============================================

/**
 * Phone number normalization result
 */
export interface NormalizedPhone {
  raw: string
  formatted: string // E.164 format with +380
  isValid: boolean
}

/**
 * Full name parts for normalization
 */
export interface NameParts {
  firstName?: string
  lastName?: string
  secondName?: string
}

/**
 * Normalized full name
 */
export interface NormalizedFullName {
  firstName: string
  lastName: string
  secondName?: string
  fullName: string // Combined: "LastName FirstName SecondName"
}

// ============================================
// ORDER TRACKING TYPES
// ============================================

/**
 * Order tracking update request
 */
export interface OrderTrackingUpdateRequest {
  orderId: string
  orderNumber?: string
  trackingNumber: string
  phoneNumber: string
  currentStatus?: string
}

/**
 * Nova Poshta tracking result mapped to order status
 */
export interface OrderTrackingResult {
  orderId: string
  orderNumber?: string
  trackingNumber: string
  newStatus: OrderStatus
  status?: OrderStatus
  statusDetails: any
  updatedAt: Date
  updated?: boolean //indicates if the order was actually updated
  error?: string
  reason?: string // for additional context (e.g., "Status unchanged")
}

// ============================================
// EXPORT HELPER TYPES
// ============================================

/**
 * Type guard to check if value is a valid OrderStatus
 */
export function isOrderStatus(value: string): value is OrderStatus {
  return Object.values(OrderStatus).includes(value as OrderStatus)
}

/**
 * Type guard to check if value is a valid Source
 */
export function isOrderSource(value: string): value is Source {
  return Object.values(Source).includes(value as Source)
}

/**
 * Helper to create order filter params with defaults
 */
export function createOrderFilterParams(
  params: Partial<OrderFilterParams> = {}
): Required<OrderFilterParams> {
  return {
    page: params.page || 1,
    limit: params.limit || 50,
    source: params.source,
    status: params.status,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  } as Required<OrderFilterParams>
}
