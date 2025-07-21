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

export const updateRozetkaQuantity = async (
  productId: string,
  quantity: number
) => {
  try {
    const accessToken = await fetchRozetkaAccessToken()
    const baseUrl = 'https://api-seller.rozetka.com.ua/items/mass-update'
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }
    const requestBody = {
      isIgnoreCheck: false, // Set to true if you want to skip validation
      items: [
        {
          item_id: parseInt(productId), // Convert to number as required by API
          stock_quantity: quantity
        },
      ],
    }

    console.log(`🔄 Updating product ${productId} quantity to ${quantity}...`)

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
export const updateMultipleRozetkaQuantities = async (
  products: Array<{ productId: string; quantity: number }>
) => {
  try {
    const accessToken = await fetchRozetkaAccessToken()
    const baseUrl = 'https://api-seller.rozetka.com.ua/items/mass-update'
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }

    const requestBody = {
      isIgnoreCheck: false,
      items: products.map((product) => ({
        item_id: parseInt(product.productId),
        stock_quantity: product.quantity,
      })),
    }

    console.log(`🔄 Updating ${products.length} products quantities...`)

    const response = await axios.put(baseUrl, requestBody, {
      headers,
    })

    if (response.data.success) {
      console.log(`✅ ${products.length} products updated successfully`)
      return response.data
    } else {
      console.error(`❌ Failed to update products:`, response.data)
      throw new Error(`Update failed: ${JSON.stringify(response.data)}`)
    }
  } catch (error: any) {
    console.error(
      `❌ Error updating products quantities:`,
      error.response?.data || error.message
    )
    throw new Error(`Failed to update products quantities: ${error.message}`)
  }
}

// Function to update both price and quantity (since the API supports both)
export const updateRozetkaPriceAndQuantity = async (
  productId: string,
  price?: number,
  quantity?: number
) => {
  try {
    const accessToken = await fetchRozetkaAccessToken()
    const baseUrl = 'https://api-seller.rozetka.com.ua/items/mass-update'
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }

console.log('price', price);


    const item: any = {
      item_id: parseInt(productId)
    }

    if (price !== undefined) {
      item.price = price
    }
    if (quantity !== undefined) {
      item.stock_quantity = quantity
    }

    const requestBody = {
      isIgnoreCheck: false,
      items: [item]
    }
console.log('requestBody', requestBody);


    console.log(`🔄 Updating product ${productId}...`)
    
    const response = await axios.put(baseUrl, requestBody, {
      headers,
    })

    if (response.data.success) {
      console.log(`✅ Product ${productId} updated successfully`)
      return response.data
    } else {
      console.error(`❌ Failed to update product ${productId}:`, response.data)
      throw new Error(`Update failed: ${JSON.stringify(response.data)}`)
    }
  } catch (error: any) {
    console.error(
      `❌ Error updating product ${productId}:`,
      error.response?.data || error.message
    )
    throw new Error(`Failed to update product: ${error.message}`)
  }
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

async function updateRozetkaProducts() {
  try {
    // Step 1: Get access token
    //const accessToken = await fetchRozetkaAccessToken()

    // Step 2: Update product using the token, product ID and quantity
    /* const response = await updateRozetkaQuantity('110365589', 5, 51)
    console.log(response) */

    /* const response = await updateMultipleRozetkaQuantities([
      { productId: '110365589', quantity: 11 },
      { productId: '110365578', quantity: 5 },
    ]) */

const response = await updateRozetkaPriceAndQuantity('110365589', 4350, 3)
    console.log(response)
    // return allProducts
  } catch (error: any) {
    console.error('❌ Main process failed:', error.message)
    throw error
  }
}
//fetchRozetkaProduct()
//updateRozetkaProducts()
