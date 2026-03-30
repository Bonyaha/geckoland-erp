import axios from 'axios'
import * as fs from 'fs/promises'
import { config } from '../../config/environment'
import { rozetkaTokenManager } from './rozetkaTokenCache'
import { Source } from '../../config/database'
import { RozetkaProductData } from '../../types/products'

// Function to fetch all Rozetka products with pagination. It is used internally by functions below.
async function fetchAllRozetkaProducts(accessToken: string): Promise<any[]> {
  const baseUrl = 'https://api-seller.rozetka.com.ua/goods/all'
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Language': 'uk',
  }

  let allProducts: any[] = []
  let currentPage = 1
  const pageSize = 20 // Maximum items per page
  let totalPages = 1 // Will be updated from first response

  //console.log('📦 Starting to fetch all products with pagination...')

  try {
    while (currentPage <= totalPages) {
      /*   console.log(
        `Fetching page ${currentPage}/${totalPages} (${pageSize} items per page)`
      ) */

      const response = await axios.get(baseUrl, {
        headers,
        params: {
          page: currentPage,
          pageSize: pageSize,
          sort: 'rz_item_id', // Optional: sort by item ID
        },
      })

      // console.log('Response received:', response.data);

      const { content } = response.data
      const { items, _meta } = content

      // Update pagination info from first response
      if (currentPage === 1) {
        totalPages = _meta.pageCount
        /* console.log(
          `📊 Total products: ${_meta.totalCount}, Total pages: ${totalPages}`
        ) */
      }

      if (items && items.length > 0) {
        allProducts.push(...items)
        /*  console.log(
          `✅ Fetched ${items.length} products from page ${currentPage}. Total so far: ${allProducts.length}`
        ) */
      } else {
        console.log(`⚠️ No products returned from page ${currentPage}`)
      }
      currentPage++

      // Small delay to be respectful to the API
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    console.log(`🎉 Finished! Total products fetched: ${allProducts.length}`)
    // Filter products with status 'on_display'
    const filteredProducts = allProducts.filter(
      (product) => product.available !== 2,
    )
    console.log('Total filteredProducts: ', filteredProducts.length)

    return allProducts
  } catch (error: any) {
    console.error(
      '❌ Error fetching products:',
      error.response?.data || error.message,
    )
    throw new Error(`Failed to fetch products: ${error.message}`)
  }
}

//Function to fetch Rozetka products without transformation
export async function fetchRozetkaProducts() {
  try {
    // Step 1: Get access token
    const accessToken = await rozetkaTokenManager.getValidToken()

    // Step 2: Fetch all products using the token
    const allProducts = await fetchAllRozetkaProducts(accessToken)
    console.log('allProducts', allProducts[0])

    return allProducts
  } catch (error: any) {
    // If error might be due to invalid token, clear cache and retry once
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.log('🔄 Token might be invalid, clearing cache and retrying...')
      rozetkaTokenManager.clearCache()

      try {
        const accessToken = await rozetkaTokenManager.getValidToken()
        const allProducts = await fetchAllRozetkaProducts(accessToken)
        return allProducts
      } catch (retryError: any) {
        console.error('❌ Main process failed on retry:', retryError.message)
        throw retryError
      }
    }

    console.error('❌ Main process failed:', error.message)
    throw error
  }
}

//Function to fetch Rozetka products and transform them to match the database structure
export async function fetchRozetkaProductsWithTransformation(): Promise<
  RozetkaProductData[]
> {
  try {
    // Step 1: Get access token
    const accessToken = await rozetkaTokenManager.getValidToken()

    // Step 2: Fetch all products using the token
    const allProducts = await fetchAllRozetkaProducts(accessToken)

    // Step 3: Save products to file
    const transformedProducts = allProducts.map((item: any) => ({
      productId: String(item.rz_item_id),
      sku: item.article || null,
      externalIds: { prom: null, rozetka: String(item.item_id) },
      name: item.name,
      price: String(item.price || '0.00'),
      stockQuantity: item.stock_quantity || 0,
      available: item.available === 1,
      priceOld: item.price_old ? String(item.price_old) : null,
      pricePromo: item.price_promo ? String(item.price_promo) : null,
      updatedPrice: item.updated_price ? String(item.updated_price) : null,
      mainImage: item.photo_preview?.[0] || null,
      images: item.photo || [],
      dateModified: item.created_at ? new Date(item.created_at) : null,
      categoryData: {
        id: item.rz_category?.id || null,
        title: item.rz_category?.title_ua || null,
      },
    }))

    await fs.writeFile(
      'prisma/data/rozetkaProducts.json',
      JSON.stringify(transformedProducts, null, 2),
    )
    console.log(
      'Rozetka products data saved to prisma/data/rozetkaProducts.json',
    )

    return transformedProducts
  } catch (error: any) {
    console.error('❌ Main process failed:', error.message)
    throw error
  }
}

//fetchAllRozetkaProducts()
//fetchRozetkaProducts()
//fetchRozetkaProductsWithTransformation()
