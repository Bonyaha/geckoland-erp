//server/src/services/marketplaces/rozetkaClient.ts
import axios from 'axios'
import {config} from '../../config/environment'
import { rozetkaTokenManager } from '../data-fetchers/rozetkaTokenCache'


/**
 * ============ PRODUCT LOGIC ===============
 */

export const getProductQuantity = async (
  productId: string,
  accessToken: string
) => {
  const baseUrl = 'https://api-seller.rozetka.com.ua/goods/all'
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Language': 'uk',
  }

  try {
    const response = await axios.get(baseUrl, {
      headers,
      params: {
        rz_item_id: productId,
      },
    })

    const productData = response.data // Assuming the response includes an array of products
    console.log(
      `Fetched product data for ID ${productId}:`,
      productData.content.items?.[0]
    )

    const product_quantity = productData.content.items?.[0].stock_quantity // depends on exact API response

    console.log(`Product quantity for ID ${productId}:`, product_quantity)

    return product_quantity // Adjust key name based on real API response
  } catch (error: any) {
    console.error(
      '❌ Error fetching product quantity:',
      error.response?.data || error.message
    )
    throw new Error(`Failed to get product quantity: ${error.message}`)
  }
}

export interface RozetkaUpdateParams {
  quantity?: number
  price?: number
  // Add more fields as needed in the future
  // isIgnoreCheck?: boolean
}

interface RozetkaProductUpdate {
  item_id: number
  stock_quantity?: number
  price?: number
  // Add more fields as needed
}

// Function to update a single Rozetka product
export const updateRozetkaProduct = async (
  productId: string,
  updates: RozetkaUpdateParams,
  options: { isIgnoreCheck?: boolean } = {}
) => {
  try {
    const accessToken = await rozetkaTokenManager.getValidToken()
    const baseUrl = 'https://api-seller.rozetka.com.ua/items/mass-update'
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }

    const item: RozetkaProductUpdate = {
      item_id: parseInt(productId),
    }

    if (updates.quantity !== undefined) {
      item.stock_quantity = updates.quantity
    }
    if (updates.price !== undefined) {
      item.price = updates.price
    }

    const requestBody = {
      isIgnoreCheck: options.isIgnoreCheck || true,
      items: [item],
    }

    console.log(`🔄 Updating Rozetka product ${productId}:`, updates)

    const response = await axios.put(baseUrl, requestBody, {
      headers,
    })

    if (response.data.success) {
      console.log(`✅ Product ${productId} quantity updated successfully`)
      return response.data
    } else {
      console.error(`❌ Failed to update product ${productId}:`, response.data)
      throw new Error(`Update failed: ${JSON.stringify(response.data)}`)
    }
  } catch (error: any) {
    console.error(
      `❌ Error updating product ${productId} quantity:`,
      error.response?.data || error.message
    )
    throw new Error(`Failed to update product quantity: ${error.message}`)
  }
}

// Updated function to handle multiple products at once (more efficient)
export const updateMultipleRozetkaProducts = async (
  products: Array<{ productId: string; updates: RozetkaUpdateParams }>,
  options: { isIgnoreCheck?: boolean } = {}
) => {
  try {
    const accessToken = await rozetkaTokenManager.getValidToken()
    const baseUrl = 'https://api-seller.rozetka.com.ua/items/mass-update'
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }

    const requestBody = {
      isIgnoreCheck: options.isIgnoreCheck || false,
      items: products.map(({ productId, updates }) => {
        const item: RozetkaProductUpdate = {
          item_id: parseInt(productId),
        }

        if (updates.quantity !== undefined) {
          item.stock_quantity = updates.quantity
        }
        if (updates.price !== undefined) {
          item.price = updates.price
        }

        return item
      }),
    }

    console.log(`🔄 Updating ${products.length} Rozetka products...`)

    const response = await axios.put(baseUrl, requestBody, {
      headers,
    })

    if (response.data.success) {
      console.log(`✅ ${products.length} Rozetka products updated successfully`)
      return response.data
    } else {
      console.error(`❌ Failed to update products:`, response.data)
      throw new Error(`Update failed: ${JSON.stringify(response.data)}`)
    }
  } catch (error: any) {
    console.error(
      `❌ Error updating Rozetka products:`,
      error.response?.data || error.message
    )
    throw new Error(`Failed to update Rozetka products: ${error.message}`)
  }
}

// Backward compatibility functions (optional - can be removed later)
export const updateRozetkaQuantity = async (
  productId: string,
  quantity: number
) => {
  return updateRozetkaProduct(productId, { quantity })
}

export const updateRozetkaPriceAndQuantity = async (
  productId: string,
  price?: number,
  quantity?: number
) => {
  const updates: RozetkaUpdateParams = {}
  if (price !== undefined) updates.price = price
  if (quantity !== undefined) updates.quantity = quantity
  return updateRozetkaProduct(productId, updates)
}

async function fetchRozetkaProduct() {
  try {
    // Step 1: Get access token
    const accessToken = await rozetkaTokenManager.getValidToken()

    // Step 2: Fetch product using the token
    const product = await getProductQuantity('498694064', accessToken)
    console.log(product)

    // return product
  } catch (error: any) {
    console.error('❌ Main process failed:', error.message)
    throw error
  }
}

/**
 * ============ ORDERS LOGIC ===============
 */

interface RozetkaOrdersResponse {
  success: boolean
  content: {
    orders: RozetkaOrder[] // Note: it's "orders", not "items"
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

interface RozetkaOrder {
  id: number
  created: string // Date string format: "2019-07-25 11:49:32"
  changed: string // Date string format: "2019-12-17 17:34:58"
  amount: string // String format: "640.00"
  amount_with_discount?: string // String format: "640.00"
  cost: string // String format: "640.00"
  cost_with_discount?: string // String format: "640.00"
  status: number // Status ID
  status_group: number
  user_phone: string
  comment?: string // User comment
  seller_comment?: any[] // Array of seller comments
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

  // Expanded fields (when using expand parameter)
  user?: {
    id: number
    has_email: boolean
    contact_fio: string // Full name: "Василенко Василь"
    email: string | boolean // Can be "true" or actual email
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
  payment_type?: string // "cash"
  payment_type_title?: string // "Готівкова"
  payment_type_name?: string // "Оплата під час отримання товару"

  // Additional optional fields
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

interface RozetkaOrderItem {
  id: number // Purchase ID
  cost: string // String format: "640.00"
  cost_with_discount?: string
  price: string // String format: "640.00"
  price_with_discount?: string
  quantity: number
  item_id: number // Product ID
  item_name: string

  item?: {
    id: number
    name: string
    name_ua?: string | null
    article?: string // SKU equivalent
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

export class RozetkaClient {
  private baseUrl: string

  constructor() {
    this.baseUrl = 'https://api-seller.rozetka.com.ua'
  }

  private async makeRequest<T>(
    endpoint: string,
    params: Record<string, any> = {}
  ): Promise<T> {
    try {
      const accessToken = await rozetkaTokenManager.getValidToken()

      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Language': 'uk',
        },
        params,
      })
      return response.data as T
    } catch (error: any) {
      handleAxiosError(error, `GET ${endpoint}`)
    }
  }

  /**
   * Get orders from Rozetka API
   */
  async getOrders(
    params: {
      id?: number
      status?: number
      created_from?: string
      created_to?: string
      changed_from?: string
      changed_to?: string
      user_name?: string
      user_phone?: string
      amount_from?: number
      amount_to?: number
      type?: number // 1 - processing, 2 - successfully completed, 3 - unsuccessfully completed
      types?: number // 1 - all, 2 - processing, 3 - successfully completed, 4 - new, 5 - delivering, 6 - unsuccessfully completed
      is_viewed?: boolean
      page?: number
      sort?: string
      expand?: string
    } = {}
  ): Promise<RozetkaOrdersResponse> {
    // Convert boolean to number for API
    const apiParams: Record<string, any> = { ...params }
    if (params.is_viewed !== undefined) {
      apiParams.is_viewed = params.is_viewed ? 1 : 0
    }

    return this.makeRequest<RozetkaOrdersResponse>('/orders/search', apiParams)
  }

  /**
   * Get new/unprocessed orders from Rozetka
   * Using type=4 for new orders
   */
  async getNewOrders(): Promise<RozetkaOrder[]> {
    try {
      // First try to get new orders (types=4)
      console.log('🔍 Fetching new orders from Rozetka...')

      const response = await this.getOrders({
        types: 4, // 4 - new orders, 1 - all orders
        expand: 'purchases,delivery,payment,user,status_data',
        sort: '-created',
      })

      if (!response.success || !response.content?.orders) {
        console.log('⚠️ No new orders found or API response error')
        return []
      }

      const newOrders = response.content.orders
      console.log(`📦 Found ${newOrders.length} new orders from Rozetka`)

      return newOrders
    } catch (error: any) {
      console.error('❌ Error fetching new orders from Rozetka:', error.message)
      throw error
    }
  }
}

/**
 * ============ ERROR HANDLER ===============
 */
function handleAxiosError(error: any, context: string): never {
  if (error.response) {
    console.error(`❌ HTTP error ${context}:`, {
      status: error.response.status,
      data: error.response.data,
    })
    throw new Error(
      `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`
    )
  } else if (error.message) {
    console.error(`❌ Error ${context}:`, error.message)
    throw error
  } else {
    console.error(`❌ Unknown error ${context}:`, error)
    throw new Error('Unknown error occurred')
  }
}

export type { RozetkaOrder, RozetkaOrderItem }

/* updateRozetkaProduct('110365589', {
  price: 4340,
}) */
