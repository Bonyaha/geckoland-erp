// server/src/types/marketplaces.ts
import {Prisma} from '../config/database'
/**
 * ============================================
 * SHARED MARKETPLACE TYPES
 * ============================================
 * Centralized type definitions for marketplace integrations
 * to avoid duplication and ensure type consistency
 */

// ============================================
// COMMON TYPES
// ============================================

/**
 * Supported marketplace sources
 */
export type TargetMarketplace = 'prom' | 'rozetka' | 'all'

/**
 * Generic update parameters for marketplace products.
 * Used when updating product information across different marketplaces.
 * 
 * @remarks
 * This matches 'productUpdateParamsSchema' in product.schema.ts
 * 
 * @example
 * const updates: BaseProductUpdateParams = {
 *   quantity: 10,
 *   price: 299.99
 * }
 */
export interface BaseProductUpdateParams {
  quantity?: number
  price?: number
}

/**
 * Input structure for batch update operations across multiple products.
 * Used when updating multiple products at once through the API.
 * 
 * @remarks
 * This matches 'updateBatchProductSchema' body in product.schema.ts
 * 
 * @example
 * const batchUpdate: BatchUpdateInput = {
 *   targetMarketplace: 'all',
 *   products: [
 *     { productId: 'prod_123', updates: { quantity: 5 } },
 *     { productId: 'prod_456', updates: { price: 199.99 } }
 *   ]
 * }
 */
export interface BatchUpdateInput {
  targetMarketplace?: TargetMarketplace
  products: Array<{
    productId: string
    updates: BaseProductUpdateParams
  }>
}

/**
 * Result of a marketplace update operation for error tracking and reporting.
 * Used to track success/failure of individual marketplace sync operations.
 * 
 * @remarks
 * Use this type instead of inline `{ marketplace: string; error: string }` objects
 * for consistency and type safety across the codebase.
 * 
 * @example
 * const results: MarketplaceUpdateResult[] = []
 * 
 * try {
 *   await updatePromProduct(productId, updates)
 *   results.push({ marketplace: 'Prom', success: true })
 * } catch (error) {
 *   results.push({ 
 *     marketplace: 'Prom', 
 *     success: false, 
 *     error: error.message 
 *   })
 * }
 */
export interface MarketplaceUpdateResult {
  marketplace: string
  success: boolean
  error?: string
}

/**
 * Represents the strict structure of the 'externalIds' JSON field in Prisma.
 * Used to cast the 'any' type coming from Prisma/Zod to ensure type safety.
 * 
 * @remarks
 * externalIds is a JSON column.
 * For READS: Prisma returns JSON with weak typing, so cast to ProductExternalIds
 *           when accessing properties in application code.
 *
 * For WRITES: Prisma requires Prisma.InputJsonValue-compatible objects.
 *            When persisting externalIds, cast/convert to Prisma.InputJsonValue
 *            (or use a dedicated Json type) to satisfy the index signature requirement.
 * 
 * @example
 * const product = await prisma.products.findUnique({ where: { productId } })
 * const externalIds = product.externalIds as ProductExternalIds
 * 
 * if (externalIds?.prom) {
 *   await updatePromProduct(externalIds.prom, updates)
 * }
 */
export interface ProductExternalIds {
  prom?: string
  rozetka?: {
    rz_item_id?: string
    item_id?: string
  }
  // Add other marketplaces here in the future
}

export type ProductExternalIdsJson = Prisma.InputJsonObject & ProductExternalIds

// ============================================
// PROM MARKETPLACE TYPES
// ============================================

/**
 * Parameters for updating a Prom marketplace product.
 * Extends BaseProductUpdateParams with Prom-specific options.
 * 
 * @example
 * const updates: PromUpdateParams = {
 *   quantity: 15,
 *   price: 349.99
 * }
 * await updatePromProduct('1234567', updates)
 */
export interface PromUpdateParams extends BaseProductUpdateParams {}

/**
 * Prom product update payload structure for Prom API requests.
 * This is the exact format expected by Prom's API endpoint.
 * 
 * @remarks
 * Used internally by promClient.ts when making API calls.
 * Do not use directly in services - use PromUpdateParams instead.
 * 
 * @example
 * ```typescript
 * const payload: PromProductUpdate = {
 *   id: 1234567,
 *   price: 299.99,
 *   quantity_in_stock: 10,
 *   presence: 'available'
 * }
 * ```
 */
export interface PromProductUpdate {
  id: number
  price?: number
  quantity_in_stock?: number
  presence?: 'available' | 'not_available'
}

/**
 * Response structure from Prom's orders list API endpoint.
 * 
 * @example
 * const response: PromOrdersResponse = await promClient.getOrders({ status: 'pending' })
 * console.log(`Found ${response.orders.length} orders`)
 */
export interface PromOrdersResponse {
  orders: PromOrder[]
}

/**
 * Complete Prom order structure with all customer, delivery, and payment information.
 * 
 * @remarks
 * This interface maps directly to Prom's API response structure.
 * Used when fetching and creating orders from Prom marketplace.
 */
export interface PromOrder {
  id: number
  date_created: string
  date_modified?: string
  client_id?: string
  client_first_name: string
  client_last_name: string
  client_second_name?: string
  phone: string
  email?: string
  delivery_recipient?: {
    first_name?: string
    last_name?: string
    second_name?: string
    phone?: string
  }
  delivery_option?: {
    id: number
    name: string
  }
  delivery_address?: string
  delivery_cost?: number
  delivery_provider_data?: any
  payment_option?: {
    id: number
    name: string
  }
  payment_data?: any
  price: string
  full_price?: string
  status: string
  status_name?: string
  client_notes?: string
  cpa_commission?: {
    amount: string
    is_refunded: boolean
  }
  prosale_commission?: {
    value: number
  }
  utm?: any
  source?: string
  dont_call_customer_back?: boolean
  products: PromOrderItem[]
}

/**
 * Individual product item within a Prom order.
 */
export interface PromOrderItem {
  id: number
  sku?: string
  name: string
  name_multilang?: any
  image?: string
  url?: string
  quantity: number
  price: string
  total_price: string
  measure_unit?: string
  cpa_commission?: {
    amount: string
  }
}

/**
 * Structure for batch updating multiple Prom products at once.
 * Use this type when updating multiple products to ensure consistency.
 * 
 * @remarks
 * Prefer this over inline types: `Array<{ productId: string; updates: PromUpdateParams }>`
 * 
 * @example
 * const batchUpdates: PromBatchUpdate[] = [
 *   { productId: '123', updates: { quantity: 5 } },
 *   { productId: '456', updates: { price: 199.99 } }
 * ]
 * await updateMultiplePromProducts(batchUpdates)
 */
export interface PromBatchUpdate {
  productId: string
  updates: PromUpdateParams
}

// ============================================
// ROZETKA MARKETPLACE TYPES
// ============================================

/**
 * Parameters for updating a Rozetka marketplace product.
 * Extends BaseProductUpdateParams with Rozetka-specific options.
 * 
 * @example
 * const updates: RozetkaUpdateParams = {
 *   quantity: 20,
 *   price: 449.99
 * }
 * await updateRozetkaProduct('110365589', updates)
 */
export interface RozetkaUpdateParams extends BaseProductUpdateParams {}

/**
 * Rozetka product update payload structure for Rozetka API requests.
 * This is the exact format expected by Rozetka's mass-update API endpoint.
 * 
 * @remarks
 * Used internally by rozetkaClient.ts when making API calls.
 * Do not use directly in services - use RozetkaUpdateParams instead.
 */
export interface RozetkaProductUpdate {
  item_id: number
  stock_quantity?: number
  price?: number
}

/**
 * Response structure from Rozetka's orders search API endpoint.
 * Includes pagination metadata and aggregated totals.
 */
export interface RozetkaOrdersResponse {
  success: boolean
  content: {
    orders: RozetkaOrder[]
    _meta: {
      totalCount: number
      pageCount: number
      currentPage: number
      perPage: number
    }
    totalFields?: {
      amount: string
      amount_with_discount: string
      cost: string
      cost_with_discount: string
    }
  }
}

/**
 * Complete Rozetka order structure with all customer, delivery, and payment information.
 * 
 * @remarks
 * This interface maps directly to Rozetka's API response structure.
 * Used when fetching and creating orders from Rozetka marketplace.
 */
export interface RozetkaOrder {
  id: number
  created: string
  changed: string
  amount: string
  amount_with_discount?: string
  cost: string
  cost_with_discount?: string
  status: number
  status_group: number
  user_phone: string
  comment?: string
  seller_comment?: any[]
  seller_comment_created?: string
  current_seller_comment?: string
  ttn?: string
  total_quantity: number
  is_viewed: boolean
  is_fulfillment?: boolean
  is_delivery_edit_available?: boolean
  is_reserve_ending?: boolean
  can_copy?: boolean
  created_type?: number
  callback_off?: number
  duplicate_order_id?: number
  user?: {
    id: number
    has_email: boolean
    contact_fio: string
    email: string | boolean
  }
  delivery?: {
    delivery_service_id: number
    delivery_service_name: string
    recipient_title?: string
    recipient_first_name?: string
    recipient_last_name?: string
    recipient_second_name?: string
    recipient_phone?: string
    place_id?: number
    place_street?: string
    place_number?: string
    place_house?: string
    place_flat?: string
    cost?: string | null
    reserve_date?: string
    city?: {
      id: number
      name: string
      name_ua: string
      region_title: string
      title: string
      status: number
    }
    delivery_method_id?: number
    ref_id?: string
    name_logo?: string
    email?: string | null
  }
  purchases: RozetkaOrderItem[]
  status_data?: {
    id: number
    name: string
    name_uk: string
    name_en: string
    status_group: number
    status: number
    color: string
  }
  payment?: {
    payment_method_id: number
    payment_method_name: string
    payment_type: string
    payment_type_title: string
    payment_status: any
    credit: any
  }
  payment_method_id?: number
  payment_type?: string
  payment_type_title?: string
  payment_type_name?: string
  items_photos?: Array<{
    id: number
    url: string
    item_url: string
    item_name: string
  }>
  chatUser?: any
  chatMessages?: any[]
  order_status_history?: any[]
  status_available?: any[]
  feedback?: any[]
  feedback_count?: number
  is_promo?: boolean
  market_review?: any
  last_update_status?: string
  delivery_commission_info?: any
  count_buyers_orders?: number
  rz_delivery_ttn_sender?: any
  has_kit?: boolean
  is_smart?: boolean
  carrier?: any
}

/**
 * Individual product item within a Rozetka order.
 */
export interface RozetkaOrderItem {
  id: number
  cost: string
  cost_with_discount?: string
  price: string
  price_with_discount?: string
  quantity: number
  item_id: number
  item_name: string
  item?: {
    id: number
    name: string
    name_ua?: string | null
    article?: string
    price_offer_id?: string
    price: string
    catalog_category?: {
      id: number
      name: string
      parent_id: number
    }
    catalog_id?: number
    group_id?: number | null
    photo_preview?: string
    photo?: string[]
    moderation_status?: number
    sla_id?: number
    url?: string
    sold?: number
    uploader_offer_id?: string
    uploader_status?: any
  }
  kit_id?: number
  conf_details?: any
  ttn?: string | null
  order_status?: any
  status?: number
  is_additional_item?: boolean
  is_smart?: boolean
}

/**
 * Structure for batch updating multiple Rozetka products at once.
 * Use this type when updating multiple products to ensure consistency.
 * 
 * @remarks
 * Prefer this over inline types: `Array<{ productId: string; updates: RozetkaUpdateParams }>`
 * 
 * @example
 * const batchUpdates: RozetkaBatchUpdate[] = [
 *   { productId: '110365589', updates: { quantity: 10 } },
 *   { productId: '110365590', updates: { price: 299.99 } }
 * ]
 * await updateMultipleRozetkaProducts(batchUpdates)
 */
export interface RozetkaBatchUpdate {
  productId: string
  updates: RozetkaUpdateParams
}

// ============================================
// SYNC ENGINE TYPES
// ============================================

/**
 * Complex state object used during marketplace synchronization.
 * Tracks all quantity changes, deltas, and sync requirements for a single product.
 * 
 * @remarks
 * Used internally by syncMarketplaces.ts to manage synchronization logic.
 * This is a working object that accumulates changes before committing to database.
 * 
 * @example
 * const syncEntry: ProductSyncEntry = {
 *   productId: 'prod_123',
 *   stockQuantity: 100,
 *   promQuantity: 100,
 *   rozetkaQuantity: 100,
 *   externalIds: { prom: '123', rozetka: { item_id: '456' } },
 *   masterQuantityDelta: -5, // 5 items sold
 *   needsPromSync: true,
 *   needsRozetkaSync: true,
 *   syncStrategy: 'same_quantity'
 * }
 */
export interface ProductSyncEntry {
  productId: string
  
  // Snapshot of app product fields
  stockQuantity: number
  promQuantity?: number | null
  rozetkaQuantity?: number | null
  
  // Strictly typed external IDs
  externalIds?: ProductExternalIds

  // Deltas calculated from incoming feeds or orders
  promQuantityDelta?: number
  rozetkaQuantityDelta?: number
  masterQuantityDelta: number

  // Final quantities to be written to DB/API
  newPromQuantity?: number
  newRozetkaQuantity?: number
  newMasterQuantity?: number

  // Logic flags
  needsPromSync: boolean
  needsRozetkaSync: boolean
  syncStrategy: SyncStrategy
}

/**
 * Options for marketplace update helper functions.
 * Provides a unified interface for both single and batch update operations.
 * 
 * @remarks
 * Used by `createMarketplaceUpdatePromise()` in marketplaceSyncHelpers.ts
 * to handle updates consistently across different marketplaces.
 * 
 * @example
 * const options: MarketplaceUpdateOptions = {
 *   marketplaceName: 'Prom',
 *   productId: 'prod_123',
 *   updateFunction: () => updatePromProduct('123', { quantity: 10 }),
 *   onSuccess: () => console.log('Success!'),
 *   resultsArray: syncResults,
 *   errorsArray: syncErrors,
 *   isBatch: false
 * }
 * 
 * await createMarketplaceUpdatePromise(options)
 */
export interface MarketplaceUpdateOptions {
  marketplaceName: 'Prom' | 'Rozetka'
  productId?: string
  count?: number
  /** Function that performs the actual update */
  updateFunction: () => Promise<any>
  /** Callback to run on successful update */
  onSuccess?: () => void
  resultsArray: string[]
  errorsArray: Array<MarketplaceUpdateResult>
  isBatch?: boolean
}

/**
 * Tracks which marketplaces were successfully synchronized in an operation.
 * Used to determine which database fields to update after sync completes.
 * 
 * @remarks
 * Always initialize with `createMarketplaceSyncStatus()` helper function.
 * Set flags to true only after successful API calls.
 * 
 * @example
 * const syncStatus = createMarketplaceSyncStatus()
 * 
 * try {
 *   await updatePromProduct(productId, updates)
 *   syncStatus.promSynced = true
 * } catch (error) {
 *   console.error('Prom sync failed')
 * }
 * 
 * // Update database fields based on sync status
 * const dbUpdate: any = {}
 * if (syncStatus.promSynced) {
 *   dbUpdate.lastPromSync = new Date()
 * }
 */
export interface MarketplaceSyncStatus {
  promSynced: boolean
  rozetkaSynced: boolean
}

/**
 * Synchronization strategy for marketplace inventory sync.
 * Determines how quantities are synchronized between marketplaces.
 * 
 * @remarks
 * - **same_quantity**: Both marketplaces maintain identical stock levels.
 *   When one changes, both are updated to match.
 * - **different_quantity**: Each marketplace maintains independent stock levels.
 *   Changes only affect the marketplace where they occur.
 * 
 * @example
 * // Same quantity strategy - both marketplaces stay in sync
 * const strategy: SyncStrategy = 'same_quantity'
 * // If Prom shows 10 and Rozetka shows 10, and Prom sells 2:
 * // Both become 8
 * 
 * // Different quantity strategy - independent tracking
 * const strategy: SyncStrategy = 'different_quantity'
 * // If Prom shows 10 and Rozetka shows 5, and Prom sells 2:
 * // Prom becomes 8, Rozetka stays 5
 */
export type SyncStrategy = 'same_quantity' | 'different_quantity'