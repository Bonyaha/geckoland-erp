import axios from 'axios'
import * as dotenv from 'dotenv'

dotenv.config()

async function fetchRozetkaAccessToken(): Promise<string> {
  const tokenUrl = 'https://api-seller.rozetka.com.ua/sites'
  const credentials = {
    username: process.env.ROZETKA_API_USERNAME,
    password: process.env.ROZETKA_API_PASSWORD,
  }
  console.log('username', credentials.username)
  console.log('password', credentials.password)

  try {
    console.log('🔑 Fetching Rozetka access token...')

    const response = await axios.post(tokenUrl, credentials, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const {
      content: { access_token },
    } = response.data

    console.log('✅ Rozetka access token fetched successfully')
    return access_token
  } catch (error: any) {
    console.error(
      '❌ Error fetching Rozetka access token:',
      error.response?.data || error.message
    )
    throw new Error(`Failed to get access token: ${error.message}`)
  }
}

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

interface RozetkaUpdateParams {
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

export const updateRozetkaProduct = async (
  productId: string,
  updates: RozetkaUpdateParams,
  options: { isIgnoreCheck?: boolean } = {}
) => {
  try {
    const accessToken = await fetchRozetkaAccessToken()
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
    const accessToken = await fetchRozetkaAccessToken()
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
    const accessToken = await fetchRozetkaAccessToken()

    // Step 2: Fetch all products using the token
    const product = await getProductQuantity('498694064', accessToken)
    console.log(product)

    // return allProducts
  } catch (error: any) {
    console.error('❌ Main process failed:', error.message)
    throw error
  }
}


/* updateRozetkaProduct('110365589', {
  price: 4340,
}) */