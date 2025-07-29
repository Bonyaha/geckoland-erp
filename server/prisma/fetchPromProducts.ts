import axios from 'axios'
import * as fs from 'fs/promises'
import * as dotenv from 'dotenv'

dotenv.config()

async function fetchAndTransformPromProducts() {
  const apiKey = process.env.PROM_API_KEY
  if (!apiKey) throw new Error('PROM_API_KEY is not defined in .env')

  const baseUrl = 'https://my.prom.ua/api/v1/products/list'
  const headers = { Authorization: `Bearer ${apiKey}` }

  let allProducts = []
  let limit = 100 // Number of products per request
  let lastId = null // For cursor-based pagination
  let hasMoreProducts = true

  console.log('Starting to fetch all products using last_id pagination...')

  while (hasMoreProducts) {
    try {
      const params: { limit: number; last_id?: number | string | null } = {
        limit,
      }

      // Add last_id parameter if we have it (for subsequent requests)
      if (lastId !== null) {
        params.last_id = lastId
        console.log(
          `Fetching products with last_id: ${lastId}, limit: ${limit}`
        )
      } else {
        console.log(`Fetching first batch with limit: ${limit}`)
      }

      const response = await axios.get(baseUrl, {
        headers,
        params,
      })

      const { products } = response.data

      if (products && products.length > 0) {
        allProducts.push(...products)
        console.log(
          `Fetched ${products.length} products. Total so far: ${allProducts.length}`
        )

        // Get the ID of the last product for the next request
        // Assuming each product has an 'id' field
        const lastProduct = products[products.length - 1]
        const newLastId = lastProduct.id

        console.log(`Last product ID in this batch: ${newLastId}`)

        // If we got fewer products than the limit, we've reached the end
        if (products.length < limit) {
          hasMoreProducts = false
          console.log('Reached the end - got fewer products than limit')
        } else if (newLastId === lastId) {
          // Safety check: if last_id hasn't changed, break to avoid infinite loop
          hasMoreProducts = false
          console.log('Stopping - last_id unchanged')
        } else {
          lastId = newLastId
        }
      } else {
        hasMoreProducts = false
        console.log('No more products returned')
      }

      // Small delay to be respectful to the API
      await new Promise((resolve) => setTimeout(resolve, 200))
    } catch (error: any) {
      console.error(
        'Error fetching products:',
        error.response?.data || error.message
      )
      throw error
    }
  }

  console.log(`\nFinished! Total products fetched: ${allProducts.length}`)
  console.log('Example product data:', allProducts[0] || 'No products found')

  /* const transformedProducts = allProducts.map((product: any) => ({
    productId: String(product.id),
    uniqueProductKey: product.sku || `${product.name}-${product.price}`, // Fallback if SKU is missing
    externalIds: { prom: String(product.id), rozetka: null },
    name: product.name,
    price: product.price,
    stockQuantity: product.quantity_in_stock,
    inStock: product.in_stock,
    description: product.description,
    mainImage: product.main_image,
    images: product.images.map((img: any) => img.url),
    currency: product.currency,
    sellingType: product.selling_type,
    presence: product.presence,
    dateModified: new Date(product.date_modified),
    multilangData: {
      ru: product.name_multilang?.ru,
      uk: product.name_multilang?.uk,
    },
    categoryData: {
      id: product.category.id,
      caption: product.category.caption,
    },
    measureUnit: product.measure_unit,
    status: product.status,
    source: 'prom',
  }))

  await fs.writeFile(
    'prisma/data/promProducts.json',
    JSON.stringify(transformedProducts, null, 2)
  )
  console.log('Prom products data saved to prisma/realData/promProducts.json') */
}

export async function fetchPromProducts() {
  const apiKey = process.env.PROM_API_KEY
  if (!apiKey) throw new Error('PROM_API_KEY is not defined in .env')

  const baseUrl = 'https://my.prom.ua/api/v1/products/list'
  const headers = { Authorization: `Bearer ${apiKey}` }

  let allProducts = []
  let limit = 100 // Number of products per request
  let lastId = null // For cursor-based pagination
  let hasMoreProducts = true

  console.log('Starting to fetch all products using last_id pagination...')

  while (hasMoreProducts) {
    try {
      const params: { limit: number; last_id?: number | string | null } = {
        limit,
      }

      // Add last_id parameter if we have it (for subsequent requests)
      if (lastId !== null) {
        params.last_id = lastId
        console.log(
          `Fetching products with last_id: ${lastId}, limit: ${limit}`
        )
      } else {
        console.log(`Fetching first batch with limit: ${limit}`)
      }

      const response = await axios.get(baseUrl, {
        headers,
        params,
      })

      const { products } = response.data

      if (products && products.length > 0) {
        allProducts.push(...products)
        console.log(
          `Fetched ${products.length} products. Total so far: ${allProducts.length}`
        )

        // Get the ID of the last product for the next request
        // Assuming each product has an 'id' field
        const lastProduct = products[products.length - 1]
        const newLastId = lastProduct.id

        console.log(`Last product ID in this batch: ${newLastId}`)

        // If we got fewer products than the limit, we've reached the end
        if (products.length < limit) {
          hasMoreProducts = false
          console.log('Reached the end - got fewer products than limit')
        } else if (newLastId === lastId) {
          // Safety check: if last_id hasn't changed, break to avoid infinite loop
          hasMoreProducts = false
          console.log('Stopping - last_id unchanged')
        } else {
          lastId = newLastId
        }
      } else {
        hasMoreProducts = false
        console.log('No more products returned')
      }

      // Small delay to be respectful to the API
      await new Promise((resolve) => setTimeout(resolve, 200))
    } catch (error: any) {
      console.error(
        'Error fetching products:',
        error.response?.data || error.message
      )
      throw error
    }
  }

  console.log(`\nFinished! Total products fetched: ${allProducts.length}`)
  console.log(
    'Product with id 1919700674:',
    allProducts.find((product) => product.id === 1919700674) ||
      'Product not found'
  )
  return allProducts
}
//fetchPromProducts()
