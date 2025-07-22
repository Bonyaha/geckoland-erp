import axios from 'axios'
import * as dotenv from 'dotenv'
dotenv.config()

const apiKey = process.env.PROM_API_KEY

const baseUrl = 'https://my.prom.ua/api/v1/products'
const getHeaders = () => {
  if (!apiKey) throw new Error('PROM_API_KEY is not defined in .env')
  return { Authorization: `Bearer ${apiKey}` }
}

export const getProductQuantity = async (productId: string) => {
  const headers = getHeaders()
  const response = await axios.get(`${baseUrl}/${productId}`, {
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
  const url = `${baseUrl}/edit`

  // Convert string ID to number for the API
  const productUpdate: PromProductUpdate = {
    id: numericId, // Use the validated numeric ID
  }

  if (updates.price !== undefined) {
    productUpdate.price = updates.price
  }
  if (updates.quantity !== undefined) {
    productUpdate.quantity_in_stock = updates.quantity
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
  const url = `${baseUrl}/edit`

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

// Backward compatibility functions (optional - can be removed later)

/* export const updatePromQuantity = async (
  productId: string,
  quantity: number
) => {
  const headers = getHeaders()
  const url = `${baseUrl}/edit`
  const payload = [
    {
      id: productId,
      quantity_in_stock: quantity,
    },
  ]
  const response = await axios.post(url, payload, { headers })
  console.log('response', response.data)
  // Return the response data, which includes processed_ids and errors
  return response.data
} */
updatePromProduct('2121361183', { quantity: 8, price: 43 })
//updatePromQuantity('2121361183',  2 )
