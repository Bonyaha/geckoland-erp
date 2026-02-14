//server/src/services/marketplaces/rozetkaClient.ts
import axios from 'axios'
import { config } from '../../config/environment'
import { rozetkaTokenManager } from '../data-fetchers/rozetkaTokenCache'
import type {
  RozetkaUpdateParams,
  RozetkaProductUpdate,
  RozetkaBatchUpdate,
  RozetkaOrder,
  RozetkaOrderItem,
  RozetkaOrdersResponse,
} from '../../types/marketplaces'
import gmailLogger from '../../utils/gmailLogger'

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
  products: RozetkaBatchUpdate[],
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

export class RozetkaClient {
  private baseUrl: string

  constructor() {
    this.baseUrl = 'https://api-seller.rozetka.com.ua'
  }

  private async makeRequest<T>(
    endpoint: string,
    params: Record<string, any> = {},
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
gmailLogger.info('response from Rozetka is ', response.data)
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
    } = {},
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
  /**
   * Fetch a single order by ID to get updated details including tracking number
   */
  async getOrderById(orderId: string): Promise<RozetkaOrder | null> {
    try {
      const accessToken = await rozetkaTokenManager.getValidToken()

      const response = await axios.get(`${this.baseUrl}/orders/${orderId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Language': 'uk',
        },
        params: {
          expand: 'purchases,delivery,payment,user,status_data',
        },
      })

      if (response.data.success && response.data.content) {
        return response.data.content as RozetkaOrder
      }

      return null
    } catch (error: any) {
      console.error(`Failed to fetch Rozetka order ${orderId}:`, error.message)
      return null
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

export type { RozetkaOrder, RozetkaOrderItem, RozetkaUpdateParams }

/* updateRozetkaProduct('110365589', {
  price: 4340,
}) */
