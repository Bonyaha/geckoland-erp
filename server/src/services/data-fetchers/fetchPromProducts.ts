import axios from 'axios'
import * as fs from 'fs/promises'
import { all } from 'axios'
import { solar } from 'googleapis/build/src/apis/solar'
import { Source } from '../../config/database'
import { config } from '../../config/environment'
import { PromProductData } from '../../types/products'

//Function to fetch Prom products without transformation
export async function fetchPromProducts() {
  const { apiKey, baseUrl } = config.marketplaces.prom
  const productsUrl = `${baseUrl}/products/list`
  const headers = { Authorization: `Bearer ${apiKey}` }

  let allProducts = []
  let limit = 100 // Number of products per request
  let lastId = null // For cursor-based pagination
  let hasMoreProducts = true

  //console.log('Starting to fetch all products using last_id pagination...')

  while (hasMoreProducts) {
    try {
      const params: {
        limit: number
        last_id?: number | string | null
      } = {
        limit,
      }

      // Add last_id parameter if we have it (for subsequent requests)
      if (lastId !== null) {
        params.last_id = lastId
        /* console.log(
          `Fetching products with last_id: ${lastId}, limit: ${limit}`
        ) */
      } else {
        //console.log(`Fetching first batch with limit: ${limit}`)
      }

      const response = await axios.get(productsUrl, {
        headers,
        params,
      })

      const { products } = response.data

      if (products && products.length > 0) {
        allProducts.push(...products)
        /* console.log(
          `Fetched ${products.length} products. Total so far: ${allProducts.length}`
        ) */

        // Get the ID of the last product for the next request
        // Assuming each product has an 'id' field
        const lastProduct = products[products.length - 1]
        const newLastId = lastProduct.id

        //console.log(`Last product ID in this batch: ${newLastId}`)

        // If we got fewer products than the limit, we've reached the end
        if (newLastId === lastId) {
          // Safety check: if last_id hasn't changed, break to avoid infinite loop
          hasMoreProducts = false
          //console.log('Stopping - last_id unchanged')
        } else {
          lastId = newLastId
        }
      } else {
        hasMoreProducts = false
        //console.log('No more products returned')
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
  //console.log(allProducts[allProducts.length - 1])
  //checkForDuplicates(allProducts)

  // Filter products with status 'on_display'
  const filteredProducts = allProducts.filter(
    (product) => product.status === 'on_display'
  )
  //console.log('example of filtered product')

  //console.log(filteredProducts[0]);

  return filteredProducts
}

/**
 * Checks for duplicate products in an array based on their 'id'.
 * @param products - The array of products to check.
 * @returns An array of duplicate products found.
 */
function checkForDuplicates(products: any[]) {
  const seenIds = new Set()
  const duplicates = []

  console.log('Checking for duplicates...')

  for (const product of products) {
    if (seenIds.has(product.id)) {
      duplicates.push(product)
    } else {
      seenIds.add(product.id)
    }
  }

  if (duplicates.length > 0) {
    console.log(`Found ${duplicates.length} duplicate product(s):`)
    duplicates.forEach((p) => console.log(`  - ID: ${p.id}, Name: "${p.name}"`))
  } else {
    console.log('No duplicates found in the product list.')
  }

  return duplicates
}

//Function to fetch Prom products and transform them to match the database structure
export async function fetchPromProductsWithTransformation(): Promise<
  PromProductData[]
> {
  const allProducts = await fetchPromProducts()
  //console.log('example: ', allProducts[0])

  const transformedProducts: PromProductData[] = allProducts.map(
    (product: any) => ({
      productId: String(product.id),
      sku: product.sku || null,
      externalIds: { prom: String(product.id), rozetka: null },
      name: product.name_multilang.uk || '',
      price: String(product.price || '0.00'),
      priceOld: null,
      pricePromo: null,
      updatedPrice: product.price ? String(product.price) : null,
      stockQuantity: product.quantity_in_stock || 0,
      promQuantity: product.quantity_in_stock,
      available: product.in_stock || false,
      description: product.description_multilang.uk || null,
      mainImage: product.main_image || null,
      images: product.images ? product.images.map((img: any) => img.url) : [],
      currency: product.currency || 'UAH',
      dateModified: product.date_modified
        ? new Date(product.date_modified)
        : new Date(),
      lastSynced: new Date(),
      lastPromSync: new Date(),
      needsSync: false,
      needsPromSync: false,
      needsRozetkaSync: false,
      categoryData: {
        id: product.category?.id || null,
        caption: product.category?.caption || null,
        group: product.group || null,
      },
      measureUnit: product.measure_unit || 'шт.',
      rozetkaQuantity: null,
      lastRozetkaSync: null,
      source: Source.prom,
    })
  )

  await fs.writeFile(
    'prisma/data/promProducts.json',
    JSON.stringify(transformedProducts, null, 2)
  )
  console.log('Prom products data saved to prisma/realData/promProducts.json')
  console.log('Total saved products: ', transformedProducts.length)

  return transformedProducts
}

/* async function main() {
console.log("I am on main");

  const allProducts = await fetchPromProducts()
  // You can do something with allProducts here if needed
console.log('example: ', allProducts[0].name_multilang.uk);

}

main().catch((error) => {
  console.error('An error occurred:', error)
}) */
//fetchPromProductsWithTransformation()
