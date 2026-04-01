// server/src/types/orders.ts

import {
  OrderStatus,
  Source,
  Prisma,
  DeliveryOption,
  PaymentOption,
  PaymentStatus,
} from '../config/database'
import { Decimal } from '@prisma/client/runtime/library'
import {
  OrderCustomerInfo,
  OrderDeliveryInfo as OrderDeliveryInfoInput,
  OrderPaymentInfo,
  OrderRecipientInfo,
} from '../schemas/order.schema'

/**
 * ============================================
 * ENUM MAPPING HELPERS
 * ============================================
 */

/**
 * Maps marketplace delivery option names to DeliveryOption enum
 * Handles various formats from Prom, Rozetka, and CRM
 */
export function mapToDeliveryOption(
  deliveryName: string | undefined | null,
): DeliveryOption | null {
  if (!deliveryName) return null

  const normalized = deliveryName.toLowerCase().trim()

  // Map variations to enum values
  if (normalized.includes('nova') || normalized.includes('нова')) {
    return DeliveryOption.NovaPoshta
  }
  if (normalized.includes('ukr') || normalized.includes('укр')) {
    return DeliveryOption.UkrPoshta
  }

  // If no match, return null (will be stored as null in DB)
  console.warn(`Unknown delivery option: ${deliveryName}`)
  return null
}

/**
 * Maps marketplace payment option names to PaymentOption enum
 * Handles various formats from Prom, Rozetka, and CRM
 */
export function mapToPaymentOption(
  paymentName: string | undefined | null,
): PaymentOption | null {
  if (!paymentName) return null

  const normalized = paymentName.toLowerCase().trim()

  // Map variations to enum values
  if (normalized.includes('apple') || normalized === 'apple pay') {
    return PaymentOption.ApplePay
  }
  if (normalized.includes('google') || normalized === 'google pay') {
    return PaymentOption.GooglePay
  }
  if (
    normalized.includes('rozetka') ||
    normalized.includes('розетка') ||
    normalized === 'Оплата карткою Visa/MasterCard (RozetkaPay)'
  ) {
    return PaymentOption.RozetkaPay
  }
  if (
    normalized === 'оплата на рахунок продавця' ||
    normalized.includes('передплата на картку продавця') ||
    normalized.includes('на счет') || //
    normalized.includes('на рахунок') || //
    normalized === 'оплата на счет' || //
    normalized === 'оплата по реквизитам' ||
    normalized === 'iban' //
  ) {
    return PaymentOption.IBAN
  }
  if (normalized.includes('пром') || normalized.includes('prom')) {
    return PaymentOption.PromPayment
  }
  if (
    normalized.includes('післяплата') ||
    normalized.includes('pislyaplata') ||
    normalized.includes('cash on delivery') ||
    normalized.includes('cod')
  ) {
    return PaymentOption.CashOnDelivery
  }

  // If no match, return null
  console.warn(`Unknown payment option: ${paymentName}`)
  return null
}

/*
 * Maps marketplace payment status names to PaymentStatus enum
 * Handles various formats from Prom, Rozetka, and CRM
 */

export function mapToPaymentStatus(
  status: string | undefined | null,
): PaymentStatus | null {
  if (!status) return null

  const normalized = status.toLowerCase().trim()

  if (
    ['paid', 'оплачено', 'payment_received', 'succeeded'].includes(normalized)
  ) {
    return PaymentStatus.PAID
  }
  if (
    [
      'unpaid',
      'не оплачено',
      'pending',
      'awaiting_payment',
      'created',
    ].includes(normalized)
  ) {
    return PaymentStatus.UNPAID
  }
  if (
    ['part_paid', 'part-paid', 'partial', 'partially_paid'].includes(normalized)
  ) {
    return PaymentStatus.PART_PAID
  }
  if (
    ['cancelled', 'canceled', 'refunded', 'failed', 'скасовано'].includes(
      normalized,
    )
  ) {
    return PaymentStatus.CANCELLED
  }

  console.warn(`Unknown payment status: ${status}`)
  return null
}
/**
 * ============================================
 * ORDER DOMAIN TYPES
 * ============================================
 * Types that are NOT validated by Zod (internal use only)
 * For validated types, import from schemas/order.schema.ts
 */

// Re-export validated types from schema
export type {
  OrderQueryParams,
  CRMOrderCreateInput,
  CRMOrderItem,
  OrderUpdateInput,
  SyncOrdersInput,
  OrderCustomerInfo,
  OrderRecipientInfo,
  OrderDeliveryInfo as OrderDeliveryInfoInput,
  OrderPaymentInfo,
} from '../schemas/order.schema'

// ============================================
// QUERY AND FILTER TYPES(Not validated - server responses)
// ============================================

/**
 * Filter parameters for querying orders.
 * Used when fetching orders with pagination and filtering.
 *
 * @remarks
 * All parameters are optional. If not provided, defaults will be used.
 *
 * @example
 * const filters: OrderFilterParams = {
 *   page: 1,
 *   limit: 50,
 *   source: 'prom',
 *   status: 'RECEIVED',
 *   dateFrom: '2024-01-01',
 *   dateTo: '2024-12-31'
 * }
 * const result = await orderService.getOrders(filters)
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
 * Pagination metadata returned with order list queries.
 * Provides information about the current page and total records.
 *
 * @example
 * const meta: OrderPaginationMeta = {
 *   page: 1,
 *   limit: 50,
 *   total: 250,
 *   pages: 5
 * }
 */
export interface OrderPaginationMeta {
  page: number
  limit: number
  total: number
  pages: number
}

/**
 * Standardized response structure for order list queries.
 * Includes both the orders array and pagination metadata.
 *
 * @remarks
 * Use this type for all order listing operations to maintain consistency.
 *
 * @example
 * async getOrders(params: OrderFilterParams): Promise<OrderQueryResult> {
 *   const orders = await prisma.orders.findMany({ ... })
 *   const total = await prisma.orders.count({ ... })
 *
 *   return {
 *     orders,
 *     pagination: {
 *       page: params.page || 1,
 *       limit: params.limit || 50,
 *       total,
 *       pages: Math.ceil(total / (params.limit || 50))
 *     }
 *   }
 * }
 */
export interface OrderQueryResult {
  /** Array of orders with their items */
  orders: any[] // Prisma.OrdersGetPayload<{ include: { orderItems: true } }>[]
  /** Pagination metadata */
  pagination: OrderPaginationMeta
}

/**
 * @deprecated Use OrderQueryResult instead
 * Kept for backward compatibility
 */
export interface OrderListResponse extends OrderQueryResult {}

// ============================================
// ORDER SYNC RESULT TYPES(Not validated - server responses)
// ============================================

/**
 * Result of order synchronization operations.
 * Tracks how many orders were created, skipped, or failed.
 *
 * @remarks
 * Used when fetching and creating orders from marketplaces.
 *
 * @example
 * const result: OrderSyncResult = await orderService.fetchAndCreateNewPromOrders()
 * console.log(`Created: ${result.created}, Skipped: ${result.skipped}, Errors: ${result.errors}`)
 */
export interface OrderSyncResult {
  created: number
  skipped: number
  errors: number
}

/**
 * Summary of manual order check across all marketplaces.
 * Provides aggregated results from Prom and Rozetka.
 *
 * @example
 * const summary: OrderCheckSummary = await orderService.manualCheckForNewOrders()
 * console.log(`Total created: ${summary.totals.created}`)
 * console.log(`Prom: ${summary.prom.created}, Rozetka: ${summary.rozetka.created}`)
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
// ORDER CREATION - STRUCTURED COMPONENTS
// ============================================

/**
 * Financial information for an order(internal - not from user input).
 * Contains all monetary values and commission details.
 *
 * @remarks
 * All monetary values should use Decimal type for precision.
 *
 * @example
 * const financial: OrderFinancialInfo = {
 *   totalAmount: 1500.00,
 *   totalAmountWithDiscount: 1350.00,
 *   fullPrice: 1500.00,
 *   currency: 'UAH',
 *   deliveryCost: 50.00,
 *   cpaCommission: 75.00,
 *   prosaleCommission: 50.00,
 *   isCommissionRefunded: false
 * }
 */
export interface OrderFinancialInfo {
  totalAmount: Decimal | number
  totalAmountWithDiscount?: Decimal | number
  fullPrice?: Decimal | number | null
  currency: string
  deliveryCost?: Decimal | number
  cpaCommission?: Decimal | number
  prosaleCommission?: Decimal | number
  isCommissionRefunded?: boolean
}

/**
 * Internal delivery info with enum type for deliveryOptionName
 * This is used internally in the service, after mapping from string
 */
export interface OrderDeliveryInfo extends Omit<
  OrderDeliveryInfoInput,
  'deliveryCost' | 'deliveryOptionName'
> {
  deliveryCost?: Decimal | number
  deliveryOptionName?: DeliveryOption | null
}

/**
 * Internal payment info with enum type for paymentOptionName
 * This is used internally in the service, after mapping from string
 */
export interface OrderPaymentInfoInternal extends Omit<
  OrderPaymentInfo,
  'paymentOptionName' | 'paymentStatus'
> {
  paymentOptionName?: PaymentOption | null
  paymentStatus?: PaymentStatus | null
}

/**
 * Order item structure for creation(internal).
 * Represents a single product in an order.
 *
 * @remarks
 * Use this when building order items before creating an order.
 *
 * @example
 * const item: OrderItemInput = {
 *   orderItemId: 'item_123_456_abc123',
 *   externalProductId: '456',
 *   productId: 'prod_123',
 *   sku: 'LAPTOP-001',
 *   productName: 'Gaming Laptop',
 *   quantity: 1,
 *   unitPrice: 25000.00,
 *   totalPrice: 25000.00,
 *   measureUnit: 'шт.',
 *   productImage: 'https://example.com/image.jpg',
 *   productUrl: 'https://example.com/product/123'
 * }
 */
export interface OrderItemInput {
  orderItemId: string  
  product: { connect: { productId: string } }
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
 * Base order creation input with structured components.
 * Provides a standardized structure for creating orders from any source.
 *
 * @remarks
 * This is the foundation for all order creation operations.
 * Compose customer, delivery, payment, and financial info into this structure.
 *
 * @example
 * const orderInput: BaseOrderCreateInput = {
 *   orderId: 'prom_12345_abc123',
 *   externalOrderId: '12345',
 *   source: Source.prom,
 *   orderNumber: '12345',
 *   createdAt: new Date(),
 *   customer: customerInfo,
 *   recipient: recipientInfo,
 *   delivery: deliveryInfo,
 *   payment: paymentInfo,
 *   financial: financialInfo,
 *   itemCount: 2,
 *   totalQuantity: 3,
 *   status: 'RECEIVED',
 *   orderItems: orderItems
 * }
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
  payment: OrderPaymentInfoInternal

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
  isFulfillment?: boolean
  canCopy?: boolean

  // Special offers
  specialOfferData?: any

  // Raw data backup
  rawOrderData?: any

  // Order items
  orderItems: OrderItemInput[]
}

// ============================================
// ORDER ITEM TYPES FOR SYNC (Internal)
// ============================================

/**
 * Minimal product descriptor passed to `syncInventoryAdjustment`.
 *
 * Sign convention for `quantity`:
 *   - **positive** → deduct from stock  (order placed, item added to order)
 *   - **negative** → return to stock    (order cancelled/deleted, item removed)
 *
 * @example
 * // Deduct stock when creating an order
 * const items: OrderItemForSync[] = order.orderItems.map(item => ({
 *   productId: item.productId,
 *   quantity: item.quantity,          // positive = take from stock
 * }))
 * await syncInventoryAdjustment(items, 'crm')
 *
 * @example
 * // Restore stock when cancelling an order
 * const items: OrderItemForSync[] = order.orderItems.map(item => ({
 *   productId: item.productId,
 *   quantity: -item.quantity,         // negative = return to stock
 * }))
 * await syncInventoryAdjustment(items, 'crm')
 */
export interface OrderItemForSync {
  productId: string // App's internal product ID or SKU
  quantity: number
}

/**
 * Marketplace-agnostic order item representation.
 * Used for processing items regardless of their source.
 *
 * @remarks
 * Convert marketplace-specific items to this format for unified processing.
 *
 * @example
 * function mapPromItemToUnified(promItem: PromOrderItem): UnifiedOrderItem {
 *   return {
 *     productId: null,
 *     externalProductId: promItem.id.toString(),
 *     sku: promItem.sku,
 *     name: promItem.name,
 *     quantity: promItem.quantity,
 *     unitPrice: parseFloat(promItem.price),
 *     totalPrice: parseFloat(promItem.total_price),
 *     image: promItem.image,
 *     url: promItem.url
 *   }
 * }
 */
export interface UnifiedOrderItem {
  productId: string
  sku?: string | null
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
  image?: string | null
  url?: string | null
}

// ============================================
// ORDER SERVICE RESULT TYPES
// ============================================

/**
 * Result of order creation operations.
 * Provides detailed feedback about whether order was created successfully.
 *
 * @remarks
 * Use this instead of returning just orderId string for better error handling.
 *
 * @example
 * async createOrderFromProm(promOrder: PromOrder): Promise<OrderCreationResult> {
 *   try {
 *     const orderId = await this.createOrder(...)
 *     return {
 *       orderId,
 *       success: true,
 *       message: 'Order created successfully'
 *     }
 *   } catch (error) {
 *     return {
 *       orderId: '',
 *       success: false,
 *       message: error.message
 *     }
 *   }
 * }
 */
export interface OrderCreationResult {
  orderId: string
  success: boolean
  message?: string
}

/**
 * Validation error for order data.
 * Used when validating order input before creation.
 *
 * @example
 * function validateCRMOrder(data: CRMOrderCreateInput): OrderValidationError[] {
 *   const errors: OrderValidationError[] = []
 *
 *   if (!data.clientPhone) {
 *     errors.push({
 *       field: 'clientPhone',
 *       message: 'Phone number is required',
 *       value: data.clientPhone
 *     })
 *   }
 *
 *   if (!data.items || data.items.length === 0) {
 *     errors.push({
 *       field: 'items',
 *       message: 'Order must have at least one item',
 *       value: data.items
 *     })
 *   }
 *
 *   return errors
 * }
 */
export interface OrderValidationError {
  field: string
  message: string
  value?: any
}

// ============================================
// NORMALIZATION TYPES(Internal helpers)
// ============================================

/**
 * Result of phone number normalization.
 * Tracks both raw and formatted versions of phone numbers.
 *
 * @remarks
 * Use this to validate phone numbers and track normalization status.
 *
 * @example
 * function normalizePhone(phone: string): NormalizedPhone {
 *   if (!phone) {
 *     return { raw: '', formatted: '', isValid: false }
 *   }
 *
 *   const digits = phone.replace(/\D/g, '')
 *   const formatted = digits.startsWith('380') ? `+${digits}` : `+380${digits}`
 *
 *   return {
 *     raw: phone,
 *     formatted,
 *     isValid: digits.length >= 10
 *   }
 * }
 */
export interface NormalizedPhone {
  raw: string
  formatted: string // E.164 format with +380
  isValid: boolean
}

/**
 * Name parts for normalization.
 * Used when parsing and combining name components.
 *
 * @example
 * const nameParts: NameParts = {
 *   firstName: 'Іван',
 *   lastName: 'Петренко',
 *   secondName: 'Миколайович'
 * }
 *
 * const fullName = normalizeFullName(nameParts)
 * // Returns: "Петренко Іван Миколайович"
 */
export interface NameParts {
  firstName?: string
  lastName?: string
  secondName?: string
}

/**
 * Normalized full name result.
 * Contains separated name parts and combined full name.
 *
 * @example
 * function normalizeFullName(parts: NameParts): NormalizedFullName {
 *   return {
 *     firstName: parts.firstName || '',
 *     lastName: parts.lastName || '',
 *     secondName: parts.secondName,
 *     fullName: [parts.lastName, parts.firstName, parts.secondName]
 *       .filter(Boolean)
 *       .join(' ')
 *   }
 * }
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
 * Request structure for updating order tracking status.
 * Used when checking tracking numbers with Nova Poshta API.
 *
 * @example
 * const trackingRequest: OrderTrackingUpdateRequest = {
 *   orderId: 'order_123',
 *   orderNumber: 'ORD-12345',
 *   trackingNumber: '59000123456789',
 *   phoneNumber: '+380501234567',
 *   currentStatus: 'SHIPPED'
 * }
 */
export interface OrderTrackingUpdateRequest {
  orderId: string
  orderNumber?: string
  trackingNumber: string
  phoneNumber: string
  currentStatus?: string
}

/**
 * Result of tracking status update.
 * Contains new status and detailed tracking information.
 *
 * @example
 * const trackingResult: OrderTrackingResult = {
 *   orderId: 'order_123',
 *   trackingNumber: '59000123456789',
 *   newStatus: 'DELIVERED',
 *   statusDetails: {
 *     novaPoshtaStatus: 'Одержано',
 *     statusCode: '9',
 *     actualDeliveryDate: '2024-01-15'
 *   },
 *   updatedAt: new Date(),
 *   updated: true
 * }
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
// TYPE GUARDS AND HELPERS
// ============================================

/**
 * Type guard to check if a value is a valid OrderStatus.
 *
 * @param value - The value to check
 * @returns True if value is a valid OrderStatus enum value
 *
 * @example
 * const status = req.query.status as string
 *
 * if (isOrderStatus(status)) {
 *   // TypeScript now knows status is OrderStatus
 *   params.status = status
 * } else {
 *   throw new Error(`Invalid order status: ${status}`)
 * }
 */
export function isOrderStatus(value: string): value is OrderStatus {
  return Object.values(OrderStatus).includes(value as OrderStatus)
}

/**
 * Type guard to check if a value is a valid Source enum value.
 *
 * @param value - The string value to check
 * @returns True if value is a valid Source enum value (e.g., 'prom', 'rozetka', 'crm')
 *
 * @example
 * const source = req.query.source as string
 *
 * if (isOrderSource(source)) {
 *   // TypeScript now knows source is Source type
 *   const orders = await orderService.getOrders({ source })
 * } else {
 *   throw new Error(`Invalid order source: ${source}`)
 * }
 */
export function isOrderSource(value: string): value is Source {
  return Object.values(Source).includes(value as Source)
}

/**
 * Helper function to create order filter parameters with sensible defaults.
 * Fills in missing values to create a complete filter object.
 *
 * @param params - Partial filter parameters (all fields optional)
 * @returns Complete OrderFilterParams object with defaults applied
 *
 * @remarks
 * Default values:
 * - page: 1
 * - limit: 50
 * - source, status, dateFrom, dateTo: undefined (no filtering)
 *
 * @example
 * // Create filters with only some parameters
 * const filters = createOrderFilterParams({
 *   source: 'prom',
 *   status: 'RECEIVED'
 * })
 * // Returns: { page: 1, limit: 50, source: 'prom', status: 'RECEIVED', dateFrom: undefined, dateTo: undefined }
 *
 * @example
 * // Use in API endpoint
 * router.get('/orders', (req, res) => {
 *   const filters = createOrderFilterParams({
 *     page: Number(req.query.page),
 *     limit: Number(req.query.limit),
 *     source: req.query.source as Source
 *   })
 *
 *   const result = await orderService.getOrders(filters)
 *   res.json(result)
 * })
 */
export function createOrderFilterParams(
  params: Partial<OrderFilterParams> = {},
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
