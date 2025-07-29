import axios from 'axios'
import * as fs from 'fs/promises'
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

  console.log('📦 Starting to fetch all products with pagination...')

  try {
    while (currentPage <= totalPages) {
      console.log(
        `Fetching page ${currentPage}/${totalPages} (${pageSize} items per page)`
      )

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
        console.log(
          `📊 Total products: ${_meta.totalCount}, Total pages: ${totalPages}`
        )
      }

      if (items && items.length > 0) {
        allProducts.push(...items)
        console.log(
          `✅ Fetched ${items.length} products from page ${currentPage}. Total so far: ${allProducts.length}`
        )
      } else {
        console.log(`⚠️ No products returned from page ${currentPage}`)
      }
      currentPage++

      // Small delay to be respectful to the API
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    console.log(`🎉 Finished! Total products fetched: ${allProducts.length}`)
    return allProducts
  } catch (error: any) {
    console.error(
      '❌ Error fetching products:',
      error.response?.data || error.message
    )
    throw new Error(`Failed to fetch products: ${error.message}`)
  }
}

async function fetchRozetkaProducts() {
  try {
    // Step 1: Get access token
    const accessToken = await fetchRozetkaAccessToken()

    // Step 2: Fetch all products using the token
    const allProducts = await fetchAllRozetkaProducts(accessToken)

    // Step 3: Save products to file
    const transformedProducts = allProducts.map((item: any) => ({
      productId: String(item.rz_item_id),
      uniqueProductKey: item.article || `${item.name}-${item.price}`,
      externalIds: { prom: null, rozetka: String(item.item_id) },
      name: item.name,
      price: item.price,
      stockQuantity: item.stock_quantity,
      available: item.available,
      priceOld: item.price_old,
      pricePromo: item.price_promo,
      updatedPrice: item.updated_price,
      mainImage: item.photo_preview?.[0],
      images: item.photo,
      dateModified: item.created_at ? new Date(item.created_at) : null,
      multilangData: { ru: item.name_ru, ua: item.name_ua },
      categoryData: {
        id: item.rz_category?.id,
        title: item.rz_category?.title_ua,
      },
      status: item.rz_status?.toString(),
      source: 'rozetka',
    }))

    await fs.writeFile(
      'prisma/data/rozetkaProducts.json',
      JSON.stringify(transformedProducts, null, 2)
    )
    console.log(
      'Rozetka products data saved to prisma/realData/rozetkaProducts.json'
    )
    console.log(
      'allProducts',
      allProducts.find((item: any) => item.article === '920D-KF-030')
    )

    // return allProducts
  } catch (error: any) {
    console.error('❌ Main process failed:', error.message)
    throw error
  }
}

/**
 * Fetches products from Rozetka that have been changed/updated (not applied to simple change of quantity)
 * @returns Promise<RozetkaChangedProduct[]> Array of changed products
 */
async function fetchRozetkaChangedProducts(
  accessToken: string
): Promise<any[]> {
  const baseUrl = 'https://api-seller.rozetka.com.ua/goods/changes'
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Language': 'uk',
  }

  let allChangedProducts: any[] = []
  let currentPage = 1
  let totalPages = 1
  const pageSize = 100

  console.log('🔄 Starting to fetch changed products...')
  //console.log('📋 Filters applied:', filters)

  try {
    while (currentPage <= totalPages) {
      console.log(
        `Fetching page ${currentPage}/${totalPages} (${pageSize} items per page)`
      )

      const params: Record<string, any> = {
        params: {
          page: currentPage,
          pageSize: pageSize,
          sort: 'rz_item_id', // Optional: sort by item ID
        },
      }

      // Remove undefined values to keep URL clean
      Object.keys(params).forEach((key) => {
        if (params[key] === undefined) {
          delete params[key]
        }
      })

      const response = await axios.get(baseUrl, {
        headers,
        params,
      })

      const { content } = response.data
      const { items, _meta } = content

      // Update pagination info from first response
      if (currentPage === 1) {
        totalPages = _meta.pageCount
        console.log(
          `📊 Total changed products: ${_meta.totalCount}, Total pages: ${totalPages}`
        )
      }

      if (items && items.length > 0) {
        allChangedProducts.push(...items)
        console.log(
          `✅ Fetched ${items.length} changed products from page ${currentPage}. Total so far: ${allChangedProducts.length}`
        )
      } else {
        console.log(`⚠️ No changed products returned from page ${currentPage}`)
      }

      currentPage++

      // Small delay to be respectful to the API
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    console.log(
      `🎉 Finished! Total changed products fetched: ${allChangedProducts.length}`
    )
    return allChangedProducts
  } catch (error: any) {
    console.error(
      '❌ Error fetching changed products:',
      error.response?.data || error.message
    )
    throw new Error(`Failed to fetch changed products: ${error.message}`)
  }
}

export async function fetchChangedRozetkaProducts() {
  try {
    // Step 1: Get access token
    const accessToken = await fetchRozetkaAccessToken()

    // Step 2: Fetch all products using the token
    const allProducts = await fetchAllRozetkaProducts(accessToken)
    console.log('allProducts', allProducts[0])

     return allProducts
  } catch (error: any) {
    console.error('❌ Main process failed:', error.message)
    throw error
  }
}



//fetchAllRozetkaProducts()
//fetchRozetkaProducts()

//fetchChangedRozetkaProducts()
