//server/src/services/marketplaces/promClient.ts
import axios from 'axios'
import { config } from '../../config/environment'
import { gmailLogger } from '../../utils/gmailLogger'
import type {
  PromUpdateParams,
  PromProductUpdate,
  PromBatchUpdate,
  PromOrder,
  PromOrderItem,
  PromOrdersResponse,
} from '../../types/marketplaces'

/**
 * ============ CONFIG ===============
 */

const PROM_API_BASE_URL = config.marketplaces.prom.baseUrl
const PROM_API_KEY = config.marketplaces.prom.apiKey

const getHeaders = () => ({
  Accept: 'application/json',
  'X-LANGUAGE': 'uk',
  Authorization: `Bearer ${PROM_API_KEY}`,
})

/**
 * ============ PRODUCT LOGIC ===============
 */

const productBaseUrl = `${PROM_API_BASE_URL}/products`

export const getProductQuantity = async (productId: string) => {
  const headers = getHeaders()
  const response = await axios.get(`${productBaseUrl}/${productId}`, {
    headers,
  })
  return response.data.quantity // Adjust based on Prom’s actual response structure
}

export const updatePromProduct = async (
  productId: string,
  updates: PromUpdateParams,
) => {
  // Validate and convert productId to number
  const numericId = parseInt(productId, 10)
  if (isNaN(numericId)) {
    throw new Error(`Invalid product ID: ${productId}`)
  }

  const headers = getHeaders()
  const url = `${productBaseUrl}/edit`

  // Convert string ID to number for the API
  const productUpdate: PromProductUpdate = {
    id: numericId, // Use the validated numeric ID
  }

  if (updates.price !== undefined) {
    productUpdate.price = updates.price
  }
  if (updates.quantity !== undefined) {
    productUpdate.quantity_in_stock = updates.quantity

    // Automatically set presence based on quantity
    if (updates.quantity > 0) {
      productUpdate.presence = 'available'
    } else {
      productUpdate.presence = 'not_available'
    }
  } else {
    // If quantity is NOT being updated, default presence to 'available'
    productUpdate.presence = 'available'
  }

  const payload = [productUpdate]
  
 try {
    const response = await axios.post(url, payload, { headers })   

    // Check if the response contains an error
    if (response.data.error) {
      console.error(
        `❌ Prom API returned error for product ${productId}:`,
        response.data.error,
      )
      throw new Error(`Prom API error: ${response.data.error}`)
    }

    // Check if there are any errors in the response
    if (response.data.errors && response.data.errors.length > 0) {
      console.error(
        `❌ Prom API returned errors for product ${productId}:`,
        response.data.errors,
      )
      throw new Error(
        `Prom API errors: ${JSON.stringify(response.data.errors)}`,
      )
    }

    // Note: processed_ids will likely be numbers, so convert for comparison
    const processedIds = response.data.processed_ids?.map(String)
    if (processedIds && processedIds.includes(productId)) {
      console.log(`✅ Prom product ${productId} updated successfully`)
      return response.data
    } else {
      // Product not in processed_ids - check if there are actual errors
      const hasErrors =
        response.data.errors && Object.keys(response.data.errors).length > 0

      if (hasErrors) {
        console.error(
          `❌ Product ${productId} was not in processed_ids:`,
          response.data.processed_ids,
        )
        throw new Error(`Product ${productId} was not processed successfully`)
      } else {
        // No errors means product already had the correct values
        console.warn(
          `⚠️ Product ${productId} not in processed_ids (likely already up-to-date)`,
        )
        console.log(
          `✅ Prom product ${productId} updated successfully (already correct)`,
        )
        return response.data
      }
    }
  } catch (error: any) {
    if (error.response) {
      console.error(`❌ HTTP error updating Prom product ${productId}:`, {
        status: error.response.status,
        data: error.response.data,
      })
      throw new Error(
        `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`,
      )
    } else if (error.message) {
      console.error(
        `❌ Error updating Prom product ${productId}:`,
        error.message,
      )
      throw error
    } else {
      console.error(
        `❌ Unknown error updating Prom product ${productId}:`,
        error,
      )
      throw new Error('Unknown error occurred')
    }
  }
}

export const updateMultiplePromProducts = async (
  products: PromBatchUpdate[],
) => {
  const headers = getHeaders()
  const url = `${productBaseUrl}/edit`

  const payload = products.map(({ productId, updates }) => {
    // Validate and convert productId to number
    const numericId = parseInt(productId, 10)
    if (isNaN(numericId)) {
      throw new Error(`Invalid product ID: ${productId}`)
    }

    const productUpdate: PromProductUpdate = {
      id: numericId, // Use the validated numeric ID
    }

    if (updates.quantity !== undefined) {
      productUpdate.quantity_in_stock = updates.quantity

      // Automatically set presence based on quantity
      if (updates.quantity > 0) {
        productUpdate.presence = 'available'
      } else {
        productUpdate.presence = 'not_available'
      }
    } else {
      // If quantity is NOT being updated, default presence to 'available'
      productUpdate.presence = 'available'
    }

    if (updates.price !== undefined) {
      productUpdate.price = updates.price
    }

    return productUpdate
  })

  console.log(`🔄 Updating ${products.length} Prom products...`)

  try {
    const response = await axios.post(url, payload, { headers })    

    // Check if the response contains an error
    if (response.data.error) {
      console.error(
        `❌ Prom API returned error for batch update:`,
        response.data.error,
      )
      throw new Error(`Prom API error: ${response.data.error}`)
    }

    // Check if there are any errors in the response
    if (response.data.errors && response.data.errors.length > 0) {
      console.error(
        `❌ Prom API returned errors for batch update:`,
        response.data.errors,
      )
      throw new Error(
        `Prom API errors: ${JSON.stringify(response.data.errors)}`,
      )
    }

    // Check processed_ids if available
    if (response.data.processed_ids) {
      const processedIds = response.data.processed_ids.map(String)
      const requestedIds = products.map((p) => p.productId)
      const notProcessed = requestedIds.filter(
        (id) => !processedIds.includes(id),
      )

      if (notProcessed.length > 0) {
        // Check if there are actual errors for these products
        const hasErrors =
          response.data.errors && Object.keys(response.data.errors).length > 0

        if (hasErrors) {
          console.error(
            `❌ Some products were not processed with errors:`,
            notProcessed,
          )
          throw new Error(`Products not processed: ${notProcessed.join(', ')}`)
        } else {
          // No errors means products already had the correct values
          console.warn(
            `⚠️ Products not in processed_ids (likely already up-to-date): ${notProcessed.join(', ')}`,
          )
          // Don't throw - this is a success case
        }
      }
    }

    console.log(`✅ ${products.length} Prom products updated successfully`)
    return response.data
  } catch (error: any) {
    if (error.response) {
      console.error(`❌ HTTP error updating batch of Prom products:`, {
        status: error.response.status,
        data: error.response.data,
      })
      throw new Error(
        `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`,
      )
    } else if (error.message) {
      console.error(`❌ Error updating batch of Prom products:`, error.message)
      throw error
    } else {
      console.error(`❌ Unknown error updating batch of Prom products:`, error)
      throw new Error('Unknown error occurred')
    }
  }
}

/**
 * ============ ORDERS LOGIC ===============
 */

export class PromClient {
  private baseUrl: string
  constructor() {
    this.baseUrl = PROM_API_BASE_URL
  }

  private async makeRequest<T>(
    endpoint: string,
    params: Record<string, any> = {},
  ): Promise<T> {
    try {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        headers: getHeaders(),
        params,
      })
      gmailLogger.info('response from Prom is: ', response.data)

      return response.data as T
    } catch (error: any) {
      handleAxiosError(error, `GET ${endpoint}`)
    }
  }

  async getOrders(
    params: {
      status?: string
      date_from?: string
      date_to?: string
      last_modified_from?: string
      last_modified_to?: string
      limit?: number
      sort_dir?: string
      last_id?: number
    } = {},
  ): Promise<PromOrdersResponse> {
    return this.makeRequest<PromOrdersResponse>('/orders/list', params)
  }

  /**
   * Fetches new orders from Prom with retry logic to handle race conditions.
   *
   * Strategy:
   * 1. If a specific orderId is provided (extracted from the Gmail subject),
   *    attempt to fetch it directly via GET /orders/:id first. This bypasses
   *    the list-endpoint propagation delay that Prom has after order creation.
   * 2. Fall back to the list endpoint (pending + paid) if direct fetch fails
   *    or no orderId was provided.
   * 3. If the list returns empty, retry with increasing delays up to 3 times.
   *
   * @param specificOrderId - Optional Prom order ID parsed from the notification email subject
   */

  async getNewOrders(
    specificOrderId?: number,
    skipRetry = false,
  ): Promise<PromOrder[]> {
    try {
      // ── FAST PATH: fetch the specific order directly ──────────────────
      if (specificOrderId) {
        gmailLogger.info(
          `server/src/services/marketplaces/promClient.ts: trying direct fetch for order #${specificOrderId}`,
        )
        const directOrder = await this.getOrderById(specificOrderId.toString())
        if (directOrder) {
          const isActionable =
            directOrder.status === 'pending' || directOrder.status === 'paid'

          if (isActionable) {
            gmailLogger.info(
              `Prom getNewOrders: direct fetch succeeded for order #${specificOrderId} (status: ${directOrder.status})`,
            )
            return [directOrder]
          }

          gmailLogger.info(
            `Prom getNewOrders: order #${specificOrderId} has status "${directOrder.status}" — not actionable, falling back to list`,
          )
        } else {
          gmailLogger.warn(
            `Prom getNewOrders: direct fetch returned null for order #${specificOrderId}, falling back to list`,
          )
        }
      }

      // ── FALLBACK: list endpoint with increasing delays ────────────────
      const RETRY_DELAYS_MS = skipRetry ? [0] : [0, 5000, 15000, 30000] // 0s, 5s, 15s, 30s

      for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
        const delay = RETRY_DELAYS_MS[attempt]

        if (delay > 0) {
          gmailLogger.warn(
            `Prom getNewOrders: list empty on attempt ${attempt}. Waiting ${delay / 1000}s before retry...`,
          )
          await new Promise((resolve) => setTimeout(resolve, delay))
        }

        const [pendingResponse, paidResponse] = await Promise.all([
          this.getOrders({ status: 'pending' }),
          this.getOrders({ status: 'paid' }),
        ])

        const pendingOrders = pendingResponse.orders || []
        const paidOrders = paidResponse.orders || []
        const totalOrders = [...pendingOrders, ...paidOrders]

        gmailLogger.info(
          `Prom getNewOrders attempt ${attempt + 1}: Found ${pendingOrders.length} pending + ${paidOrders.length} paid = ${totalOrders.length} total`,
        )

        if (totalOrders.length > 0) {
          return totalOrders
        }
      }

      gmailLogger.warn(
        `Prom getNewOrders: all attempts exhausted, returning empty`,
      )
      return []
    } catch (error: any) {
      gmailLogger.error('Failed to fetch new orders from Prom:', error.message)
      throw error
    }

    /* FOR TESTING ONLY */
    /* const ordersResponse = await this.getOrders({ status: 'delivered', limit: 5 })
    return ordersResponse.orders || [] */
  }

  /**
   * Fetch a single order by ID to get updated details including tracking number
   */
  async getOrderById(orderId: string): Promise<PromOrder | null> {
    try {
      console.log('fetching an order with id: ', orderId)

      const response = await this.makeRequest<{ order: PromOrder }>(
        `/orders/${orderId}`,
      )

      if (response.order) {
        return response.order
      }
      return null
    } catch (error: any) {
      console.error(`Failed to fetch Prom order ${orderId}:`, error.message)
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
      `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`,
    )
  } else if (error.message) {
    console.error(`❌ Error ${context}:`, error.message)
    throw error
  } else {
    console.error(`❌ Unknown error ${context}:`, error)
    throw new Error('Unknown error occurred')
  }
}

export type {
  PromOrder,
  PromOrderItem,
  PromUpdateParams,
  PromProductUpdate,
  PromOrdersResponse,
}

// ============ TESTS / USAGE EXAMPLES ===============

//updatePromQuantity('2121361183',  2 )

//updatePromProduct('2121361183', { quantity: 8, price: 43 })
/* updateMultiplePromProducts([
  { productId: '2121361183', updates: { quantity: 8, price: 43 } },//4 39
  { productId: '1726584894', updates: { quantity: 5, price: 50 } }, //3 57
]) */
