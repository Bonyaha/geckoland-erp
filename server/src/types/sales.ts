// server/src/types/sales.ts

/**
 * ============================================
 * SALES DOMAIN TYPES
 * ============================================
 * Types for the Sales table and sales operations.
 * These are NOT validated by Zod (internal use only).
 */

/**
 * Result of creating sales records for an order.
 * Returned when sales records are created from a delivered order.
 *
 * @example
 * const result: SalesCreationResult = {
 *   success: true,
 *   salesIds: ['sale_123_prod1_abc', 'sale_123_prod2_def'],
 *   orderNumber: 'ORD-12345'
 * }
 */
export interface SalesCreationResult {
  /** Whether the operation completed successfully */
  success: boolean
  /** Array of created sale IDs */
  salesIds: string[]
  /** Optional order number for reference */
  orderNumber?: string
  /** Error message if operation failed */
  error?: string
}

/**
 * Result of backfilling sales records from existing delivered orders.
 * Provides detailed statistics about the migration process.
 *
 * @remarks
 * Used for the one-time migration to populate the Sales table
 * from existing delivered orders.
 *
 * @example
 * const result: SalesBackfillResult = {
 *   totalProcessed: 150,
 *   successfulOrders: 145,
 *   failedOrders: 5,
 *   totalSalesCreated: 290,
 *   errors: [
 *     { orderId: 'order_123', orderNumber: 'ORD-123', error: 'No productId' }
 *   ]
 * }
 */
export interface SalesBackfillResult {
  /** Total number of orders processed */
  totalProcessed: number
  /** Number of orders successfully processed */
  successfulOrders: number
  /** Number of orders that failed */
  failedOrders: number
  /** Total number of sales records created */
  totalSalesCreated: number
  /** Array of errors encountered during backfill */
  errors: SalesBackfillError[]
}

/**
 * Error details for a failed order during backfill.
 * Tracks which orders failed and why.
 *
 * @example
 * const error: SalesBackfillError = {
 *   orderId: 'order_abc123',
 *   orderNumber: 'ORD-12345',
 *   error: 'Order items missing productId'
 * }
 */
export interface SalesBackfillError {
  /** ID of the order that failed */
  orderId: string
  /** Optional order number for easier identification */
  orderNumber?: string
  /** Error message describing what went wrong */
  error: string
}

/**
 * Statistics for sales within a time period.
 * Used for analytics and reporting.
 *
 * @remarks
 * All monetary values are in the database's default currency (UAH).
 *
 * @example
 * const stats: SalesStatistics = {
 *   totalSales: 150,
 *   totalRevenue: 45000.00,
 *   totalQuantity: 300,
 *   averageOrderValue: 300.00
 * }
 */
export interface SalesStatistics {
  /** Total number of sales transactions */
  totalSales: number
  /** Total revenue from all sales */
  totalRevenue: number
  /** Total quantity of items sold */
  totalQuantity: number
  /** Average revenue per sale */
  averageOrderValue: number
}

/**
 * Query parameters for retrieving sales data.
 * Used when fetching sales records with filtering.
 *
 * @example
 * const query: SalesQueryParams = {
 *   startDate: new Date('2024-01-01'),
 *   endDate: new Date('2024-12-31'),
 *   productId: 'prod_123',
 *   page: 1,
 *   limit: 50
 * }
 */
export interface SalesQueryParams {
  /** Start date for filtering sales */
  startDate?: Date
  /** End date for filtering sales */
  endDate?: Date
  /** Filter by specific product ID */
  productId?: string
  /** Page number for pagination */
  page?: number
  /** Number of records per page */
  limit?: number
}

/**
 * Sales record data structure.
 * Mirrors the Sales table schema but as a TypeScript interface.
 *
 * @remarks
 * This is used for type safety when working with sales records
 * in the application layer.
 *
 * @example
 * const sale: SalesRecord = {
 *   saleId: 'sale_order123_prod456_abc',
 *   productId: 'prod_456',
 *   timestamp: new Date('2024-03-15'),
 *   quantity: 2,
 *   unitPrice: 150.00,
 *   totalAmount: 300.00
 * }
 */
export interface SalesRecord {
  /** Unique identifier for the sale */
  saleId: string
  /** ID of the product that was sold */
  productId: string
  /** When the sale occurred (from order delivery date) */
  timestamp: Date
  /** Quantity of items sold */
  quantity: number
  /** Price per unit at time of sale */
  unitPrice: number
  /** Total amount for this sale (quantity * unitPrice) */
  totalAmount: number
}

/**
 * Summary response for sales health check.
 * Provides insight into whether sales are being created properly.
 *
 * @example
 * const health: SalesHealthCheck = {
 *   summary: {
 *     totalChecked: 10,
 *     ordersWithSales: 8,
 *     ordersWithoutSales: 2,
 *     healthPercentage: '80.00'
 *   },
 *   recentOrders: [...]
 * }
 */
export interface SalesHealthCheck {
  /** Summary statistics */
  summary: {
    /** Total orders checked */
    totalChecked: number
    /** Orders that have sales records */
    ordersWithSales: number
    /** Orders missing sales records */
    ordersWithoutSales: number
    /** Percentage of orders with sales records */
    healthPercentage: string
  }
  /** Details of recent orders checked */
  recentOrders: SalesHealthOrderDetail[]
}

/**
 * Details about a single order in the health check.
 * Shows whether sales records exist for a delivered order.
 *
 * @example
 * const detail: SalesHealthOrderDetail = {
 *   orderId: 'order_123',
 *   orderNumber: 'ORD-12345',
 *   deliveredAt: new Date('2024-03-15'),
 *   hasSalesRecords: true,
 *   salesCount: 3
 * }
 */
export interface SalesHealthOrderDetail {
  /** Order ID */
  orderId: string
  /** Order number (human-readable) */
  orderNumber?: string
  /** When the order was delivered */
  deliveredAt?: Date
  /** Whether sales records exist */
  hasSalesRecords: boolean
  /** Number of sales records found */
  salesCount: number
}
