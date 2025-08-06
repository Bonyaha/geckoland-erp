import axios from 'axios'
import * as fs from 'fs/promises'
import * as dotenv from 'dotenv'

dotenv.config()

export async function fetchCRMProducts() {
  const apiKey = process.env.HUGEPROFIT_API_KEY
  if (!apiKey) throw new Error('HUGEPROFIT_API_KEY is not defined in .env')

  const baseUrl = 'https://h-profit.com/bapi/products'
  const headers = { Authorization: `${apiKey}` }
  let allProducts: any[] = []

  console.log('Starting to fetch all products...')

  try {
    const response = await axios.get(baseUrl, { headers })
    //console.log('Sample product:', response.data.data[0])

    const { data: products } = response.data
    console.log(`Fetched ${products.length} products.`)

    allProducts.push(...products)

    // Transform products to match database structure
    const transformedProducts = allProducts.map((product: any) => {
      const stockInfo = product.stock?.[0] || {}

      return {
        productId: String(product.id),
        sku: product.sku || null,
        name: product.name || null,
        price: parseFloat(stockInfo.price || 0),
        stockQuantity: parseInt(stockInfo.quantity || 0, 10),

        externalIds: { prom: null, rozetka: null },
        description:
          product.description === 'None' ? null : product.description,
        mainImage: product.images?.[0] || null,
        images: product.images || [],
        inStock: parseInt(stockInfo.instock || 0, 10),
        available: Boolean(stockInfo.instock > 0),
        priceOld: null,
        pricePromo:
          parseFloat(stockInfo.sale_price || 0) !==
          parseFloat(stockInfo.price || 0)
            ? parseFloat(stockInfo.sale_price || 0)
            : null,
        updatedPrice: parseFloat(stockInfo.price || 0),
        currency: 'UAH', // Assuming Ukrainian Hryvnia based on your location
        sellingType: product.type_product === 1 ? 'regular' : 'other',
        presence: stockInfo.instock > 0 ? 'available' : 'out_of_stock',
        dateModified: new Date(),
        lastSynced: new Date(),
        needsSync: false,        
        categoryData: product.category || [],
        measureUnit: product.unit || 'units',
        status: 'active',
        lastPromSync: null,
        lastRozetkaSync: null,
        needsPromSync: false,
        needsRozetkaSync: false,
        promQuantity: parseInt(stockInfo.quantity || 0, 10),
        rozetkaQuantity: parseInt(stockInfo.quantity || 0, 10),
      }
    })

    /* await fs.writeFile(
      'prisma/data/crmProducts.json',
      JSON.stringify(transformedProducts, null, 2)
    )

    console.log(`\nFinished! Total products fetched: ${allProducts.length}`)
    console.log(
      `Transformed products saved to prisma/realData/crmProducts.json`
    ) */
    return transformedProducts
  } catch (error) {
    console.error('Error fetching products from HugeProfit API:', error)
    throw error
  }
}

//fetchCRMProducts()
