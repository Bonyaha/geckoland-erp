// server/src/types/marketplaces.ts

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
 * Generic update parameters for marketplace products
 * Matches 'productUpdateParamsSchema' in product.schema.ts
 */
export interface BaseProductUpdateParams {
  quantity?: number
  price?: number
}

/**
 * Input for Batch Update Service
 * Matches 'updateBatchProductSchema' body
 */
export interface BatchUpdateInput {
  targetMarketplace?: TargetMarketplace
  products: Array<{
    productId: string
    updates: BaseProductUpdateParams
  }>
}

/**
 * Marketplace sync status tracking
 */
export interface MarketplaceSyncStatus {
  promSynced: boolean
  rozetkaSynced: boolean
}

/**
 * Synchronization strategy options
 */
export type SyncStrategy = 'same_quantity' | 'different_quantity'

/**
 * Marketplace update result for error tracking
 */
export interface MarketplaceUpdateResult {
  marketplace: string
  success: boolean
  error?: string
}

/**
 * Represents the strict structure of the 'externalIds' JSON field in Prisma.
 * Use this to cast the 'any' type coming from Prisma/Zod.
 */
export interface ProductExternalIds {
  prom?: string
  rozetka?: {
    rz_item_id?: string
    item_id?: string
  }
  // Add other marketplaces here in the future (e.g., hugeprofit)
}

// ============================================
// PROM MARKETPLACE TYPES
// ============================================

/**
 * Parameters accepted when updating a Prom product
 */
export interface PromUpdateParams extends BaseProductUpdateParams {}

/**
 * Prom product update payload for Prom API
 */
export interface PromProductUpdate {
  id: number
  price?: number
  quantity_in_stock?: number
  presence?: 'available' | 'not_available'
}

/**
 * Prom API order response
 */
export interface PromOrdersResponse {
  orders: PromOrder[]
}

/**
 * Prom order structure
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
 * Prom order item structure
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

// ============================================
// ROZETKA MARKETPLACE TYPES
// ============================================

/**
 * Parameters accepted when updating a Rozetka product
 */
export interface RozetkaUpdateParams extends BaseProductUpdateParams {}

/**
 * Rozetka product update payload for Rozetka API
 */
export interface RozetkaProductUpdate {
  item_id: number
  stock_quantity?: number
  price?: number
}

/**
 * Rozetka API orders response
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
 * Rozetka order structure
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
 * Rozetka order item structure
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

// ============================================
// SYNC HELPER TYPES
// ============================================

/**
 * Batch product update for Prom
 */
export interface PromBatchUpdate {
  productId: string
  updates: PromUpdateParams
}

/**
 * Batch product update for Rozetka
 */
export interface RozetkaBatchUpdate {
  productId: string
  updates: RozetkaUpdateParams
}

/**
 * Marketplace update options for helper functions
 */
export interface MarketplaceUpdateOptions {
  marketplaceName: 'Prom' | 'Rozetka'
  productId?: string
  count?: number
  updateFunction: () => Promise<any>
  onSuccess?: () => void
  resultsArray: string[]
  errorsArray: Array<{ marketplace: string; error: string }>
  isBatch?: boolean
}

/**
 * Tracking data for order synchronization
 */
export interface OrderSyncTracking {
  productId: string
  orderedQuantity: number
}
