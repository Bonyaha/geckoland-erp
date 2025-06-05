import axios from 'axios'
import * as fs from 'fs/promises'
import * as dotenv from 'dotenv'

dotenv.config()

async function fetchCRMProducts() {
  const apiKey = process.env.HUGEPROFIT_API_KEY
  if (!apiKey) throw new Error('HUGEPROFIT_API_KEY is not defined in .env')

  const baseUrl = 'https://h-profit.com/bapi/products'
  const headers = { Authorization: `${apiKey}` }
  let allProducts: any[] = []

  console.log('Starting to fetch all products...')

  try {
    const response = await axios.get(baseUrl, { headers })
    console.log('Sample product:', response.data.data[0])

    const { data: products } = response.data
    console.log(`Fetched ${products.length} products.`)

    allProducts.push(...products)

    const transformedProducts = allProducts.map((product: any) => ({
      productId: String(product.id),
      sku: product.sku,
      name: product.name,
      price: parseFloat(product.stock[0]?.price || 0),
      stockQuantity: parseInt(product.stock[0]?.quantity || 0, 10),
      source: 'crm',
      externalIds: { prom: null, rozetka: null },
      description: product.description === 'None' ? null : product.description,
      mainImage: product.images[0] || null,
      images: product.images || [],
      inStock: parseInt(product.stock[0]?.instock || 0, 10), // Keep as integer
      available: Boolean(product.stock[0]?.instock), // Convert to boolean (true if instock > 0)
      priceOld: null,
      pricePromo: null,
      updatedPrice: null,
      currency: null,
      sellingType: null,
      presence: null,
      dateModified: null,
      lastSynced: null,
      needsSync: false,
      multilangData: null,
      categoryData: product.category || [],
      measureUnit: product.unit || null,
      status: null,
    }))

    await fs.writeFile(
      'prisma/data/crmProducts.json',
      JSON.stringify(transformedProducts, null, 2)
    )

    console.log(`\nFinished! Total products fetched: ${allProducts.length}`)
    console.log(
      `Transformed products saved to prisma/realData/crmProducts.json`
    )
  } catch (error) {
    console.error('Error fetching products from HugeProfit API:', error)
    throw error
  }
}

fetchCRMProducts()
