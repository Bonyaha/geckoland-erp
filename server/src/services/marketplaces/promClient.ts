//server\src\services\marketplaces\promClient.ts
import axios from 'axios'
import * as dotenv from 'dotenv'
dotenv.config()

/**
 * ============ CONFIG ===============
 */

const PROM_API_BASE_URL = process.env.PROM_API_BASE_URL || 'https://my.prom.ua/api/v1'
const PROM_API_KEY = process.env.PROM_API_KEY

if (!PROM_API_KEY) {
  throw new Error('PROM_API_KEY (or PROM_API_TOKEN) environment variable is required')
}

//const baseUrl = 'https://my.prom.ua/api/v1/products'
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

interface PromUpdateParams {
  quantity?: number
  price?: number
  // Add more fields as needed in the future
  // name?: string
  // description?: string
}

interface PromProductUpdate {
  id: number // Changed from string to number
  price?: number
  quantity_in_stock?: number
  presence?: 'available' | 'not_available'
  // Add more fields as needed
}

export const updatePromProduct = async (
  productId: string,
  updates: PromUpdateParams
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
  }

  const payload = [productUpdate]
  console.log('payload', payload)
  console.log(`🔄 Updating Prom product ${productId}:`, payload)

  try {
    const response = await axios.post(url, payload, { headers })
    console.log('response', response.data)

    // Check if the response contains an error
    if (response.data.error) {
      console.error(
        `❌ Prom API returned error for product ${productId}:`,
        response.data.error
      )
      throw new Error(`Prom API error: ${response.data.error}`)
    }

    // Check if there are any errors in the response
    if (response.data.errors && response.data.errors.length > 0) {
      console.error(
        `❌ Prom API returned errors for product ${productId}:`,
        response.data.errors
      )
      throw new Error(
        `Prom API errors: ${JSON.stringify(response.data.errors)}`
      )
    }

    // Note: processed_ids will likely be numbers, so convert for comparison
    const processedIds = response.data.processed_ids?.map(String)
    if (processedIds && processedIds.includes(productId)) {
      console.log(`✅ Prom product ${productId} updated successfully`)
      return response.data
    } else if (response.data.processed_ids) {
      console.error(
        `❌ Product ${productId} was not in processed_ids:`,
        response.data.processed_ids
      )
      throw new Error(`Product ${productId} was not processed successfully`)
    }
  } catch (error: any) {
    if (error.response) {
      console.error(`❌ HTTP error updating Prom product ${productId}:`, {
        status: error.response.status,
        data: error.response.data,
      })
      throw new Error(
        `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`
      )
    } else if (error.message) {
      console.error(
        `❌ Error updating Prom product ${productId}:`,
        error.message
      )
      throw error
    } else {
      console.error(
        `❌ Unknown error updating Prom product ${productId}:`,
        error
      )
      throw new Error('Unknown error occurred')
    }
  }
}

export const updateMultiplePromProducts = async (
  products: Array<{ productId: string; updates: PromUpdateParams }>
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
    }

    if (updates.price !== undefined) {
      productUpdate.price = updates.price
    }

    return productUpdate
  })

  console.log(`🔄 Updating ${products.length} Prom products...`)

  try {
    const response = await axios.post(url, payload, { headers })
    console.log('response', response.data)

    // Check if the response contains an error
    if (response.data.error) {
      console.error(
        `❌ Prom API returned error for batch update:`,
        response.data.error
      )
      throw new Error(`Prom API error: ${response.data.error}`)
    }

    // Check if there are any errors in the response
    if (response.data.errors && response.data.errors.length > 0) {
      console.error(
        `❌ Prom API returned errors for batch update:`,
        response.data.errors
      )
      throw new Error(
        `Prom API errors: ${JSON.stringify(response.data.errors)}`
      )
    }

    // Check processed_ids if available
    if (response.data.processed_ids) {
      const processedIds = response.data.processed_ids.map(String)
      const requestedIds = products.map((p) => p.productId)
      const notProcessed = requestedIds.filter(
        (id) => !processedIds.includes(id)
      )

      if (notProcessed.length > 0) {
        console.error(`❌ Some products were not processed:`, notProcessed)
        throw new Error(`Products not processed: ${notProcessed.join(', ')}`)
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
        `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`
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

interface PromOrdersResponse {
  orders: PromOrder[]
}

interface PromOrder {
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
  price: string // comes as string from API
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

interface PromOrderItem {
  id: number
  sku?: string
  name: string
  name_multilang?: any
  image?: string
  url?: string
  quantity: number
  price: string // comes as string from API
  total_price: string // comes as string from API
  measure_unit?: string
  cpa_commission?: {
    amount: string
  }
}

export class PromClient {
  private baseUrl: string
  constructor() {
    this.baseUrl = PROM_API_BASE_URL
  }

  private async makeRequest<T>(
    endpoint: string,
    params: Record<string, any> = {}
  ): Promise<T> {
    try {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        headers: getHeaders(),
        params,
      })
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
    } = {}
  ): Promise<PromOrdersResponse> {
    return this.makeRequest<PromOrdersResponse>('/orders/list', params)
  }

  async getNewOrders(): Promise<PromOrder[]> {
    const [pendingOrdersResponse, paidOrdersResponse,receivedOrdersResponse] = await Promise.all([
      this.getOrders({ status: 'pending' }),
      this.getOrders({ status: 'paid' }),
      this.getOrders({ status: 'received', limit: 1 }),
    ])

    const pendingOrders = pendingOrdersResponse.orders || []
    const paidOrders = paidOrdersResponse.orders || []
const receivedOrders = receivedOrdersResponse.orders || []

    return [...pendingOrders, ...paidOrders, ...receivedOrders]
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

export type { PromOrder, PromOrderItem }

// ============ TESTS / USAGE EXAMPLES ===============

//updatePromQuantity('2121361183',  2 )

//updatePromProduct('2121361183', { quantity: 8, price: 43 })
/* updateMultiplePromProducts([
  { productId: '2121361183', updates: { quantity: 8, price: 43 } },//4 39
  { productId: '1726584894', updates: { quantity: 5, price: 50 } }, //3 57
]) */
