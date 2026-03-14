// server/prisma/scripts/populateDB.ts
import prisma, { Source } from '../../src/config/database'
import * as fs from 'fs'
import * as path from 'path'
import csv from 'csv-parser'
import { nanoid } from 'nanoid'
import { enrichWithPromIds } from '../../src/utils/helpers/mapExternalIdsProm'
import { enrichWithRozetkaIds } from '../../src/utils/helpers/mapExternalIdsRozetka'
import { enrichWithPromCategoriesAndDescription } from '../../src/utils/helpers/enrichWithPromCategories'
import { enrichWithRozetkaCategories } from '../../src/utils/helpers/enrichWithRozetkaCategories'
import { fetchCRMProducts } from '../../src/services/data-fetchers/fetchCRMProducts'
import { fetchPromProductsWithTransformation } from '../../src/services/data-fetchers/fetchPromProducts'
import {
  mapHPCsvToProduct,
  mapDbCsvToProduct,
} from '../../src/utils/helpers/mapCsvProductToEnriched'
import { mapPromProductToEnriched } from '../../src/utils/helpers/mapPromProductToEnriched'

/* 
    Populates the Products table from one of four sources.
  Mapper functions live in src/utils/helpers/ alongside the other data-transform
  helpers — this script contains only orchestration logic.
 
  Methods:
    'fromHP_CSV'   – products.csv from HugeProfit CRM export
    'fromDB_CSV'   – productsFromDB.csv exported from the existing database
    'fromAPI'      – fetch directly from HugeProfit API
    'fromPromAPI'  – fetch directly from Prom API
 */

// --- SHARED ENRICHMENT AND INSERT LOGIC ---

/**
 * Enriches products with external IDs and categories, then inserts them into the database.
 * This is the core logic shared by both CSV and API population methods.
 * ⚠️  DESTRUCTIVE: clears Sales, Purchases, OrderItems, and Products before
 * inserting. Only run on an empty or disposable database.
 */
async function enrichAndInsertProducts(products: any[]): Promise<void> {
  console.log(`Processing ${products.length} products...`)

  if (products.length === 0) {
    console.log('No products to process.')
    return
  }
  //console.log('example of a product: ', products[0])

  console.log('Enriching products with Prom IDs and categories...')
  let enrichedProducts = await enrichWithPromIds(products)
  enrichedProducts =
    await enrichWithPromCategoriesAndDescription(enrichedProducts)

  console.log('Enriching products with Rozetka IDs and categories...')
  enrichedProducts = await enrichWithRozetkaIds(enrichedProducts)
  enrichedProducts = await enrichWithRozetkaCategories(enrichedProducts)

  console.log('Setting marketplace quantities...')
  enrichedProducts = enrichedProducts.map((product) => ({
    ...product,
    promQuantity: product.externalIds?.prom ? product.stockQuantity : null,
    rozetkaQuantity: product.externalIds?.rozetka
      ? product.stockQuantity
      : null,
  }))

  //console.log('Clearing the Products table...')
  // Delete related records first to avoid foreign key constraint violations
  await prisma.sales.deleteMany({})
  await prisma.purchases.deleteMany({})
  await prisma.orderItems.deleteMany({})
  // Now safe to delete products
  await prisma.products.deleteMany({})

  console.log('Populating the Products table...')

  let successCount = 0
  for (const product of enrichedProducts) {
    try {
      await prisma.products.create({
        data: product,
      })
      successCount++
    } catch (error) {
      console.error(`Failed to insert product ${product.name}:`, error)
    }
  }
  //console.log('example of product id:', enrichedProducts[0]?.productId)

  console.log(
    `✅ Successfully inserted ${successCount} out of ${enrichedProducts.length} products.`,
  )
}

// --- CSV POPULATION FUNCTION ---

/**
 * Populates the database from a CSV file using the provided mapper function.
 */
async function populateProductsFromCSV(
  filePath: string,
  mapper: (row: any) => any,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const products: any[] = []

    if (!fs.existsSync(filePath)) {
      console.error(`Error: The file was not found at ${filePath}`)
      console.error(
        'Please place your CSV file in the geckoland-erp/server/prisma/data/ directory.',
      )
      reject(new Error('CSV file not found'))
      return
    }

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row: any) => {
        const product = mapper(row)
        if (product) {
          products.push(product)
        }
      })
      .on('end', async () => {
        try {
          console.log(`Found ${products.length} products in the CSV file.`)
          await enrichAndInsertProducts(products)
          resolve()
        } catch (error) {
          console.error('Error during CSV processing:', error)
          reject(error)
        }
      })
      .on('error', (error) => {
        console.error('Error reading CSV file:', error)
        reject(error)
      })
  })
}

// --- API POPULATION FUNCTION ---

/**
 * Populates the database by fetching products from HugeProfit API.
 * Uses the existing fetchCRMProducts function to get data.
 */
async function populateProductsFromAPI(): Promise<void> {
  try {
    console.log('🚀 Fetching products from HugeProfit API...')

    // Fetch products from API (this also saves to productsFromHP.json)
    const products = await fetchCRMProducts()

    if (!products || products.length === 0) {
      console.log('No products returned from API.')
      return
    }

    console.log(`✅ Fetched ${products.length} products from API`)

    // Use the shared enrichment and insert logic
    await enrichAndInsertProducts(products)
  } catch (error) {
    console.error('❌ Error fetching products from API:', error)
    throw error
  }
}
 
/**
 * Populates from the Prom API.
 *
 * Uses mapPromProductToEnriched() to convert PromProductData to the shape
 * expected by enrichAndInsertProducts(), then runs the same pipeline as
 * every other method.
 */
async function populateProductsFromPromAPI(): Promise<void> {
  console.log('🚀 Fetching products from Prom API...')
 
  const promProducts = await fetchPromProductsWithTransformation()
 
  if (!promProducts || promProducts.length === 0) {
    console.log('No products returned from Prom API.')
    return
  }
 
  console.log(`✅ Fetched ${promProducts.length} products from Prom API`)
  await enrichAndInsertProducts(promProducts.map(mapPromProductToEnriched))
}

// --- CONTROLLER TO RUN THE POPULATION ---

async function main() {
  try {
    console.log('=== Product Database Population Tool ===\n')

    // Choose your population method here:
    // 'fromHP_CSV' - Use CSV export from HugeProfit
    // 'fromDB_CSV' - Use CSV export from database
    // 'fromAPI'    - Fetch directly from HugeProfit API
    //   'fromPromAPI'  – Prom API

    const populationMethod = 'fromAPI' as
      | 'fromHP_CSV'
      | 'fromDB_CSV'
      | 'fromAPI'
      | 'fromPromAPI'

    switch (populationMethod) {
      case 'fromHP_CSV':
        console.log('📄 Using HugeProfit CSV file...\n')
        const hpCsvPath = path.join(__dirname, '..', 'data', 'products.csv')
        await populateProductsFromCSV(hpCsvPath, mapHPCsvToProduct)
        break

      case 'fromDB_CSV':
        console.log('📄 Using Database CSV export...\n')
        const dbCsvPath = path.join(
          __dirname,
          '..',
          'data',
          'productsFromDB.csv',
        )
        await populateProductsFromCSV(dbCsvPath, mapDbCsvToProduct)
        break

      case 'fromAPI':
        console.log('🌐 Using HugeProfit API...\n')
        await populateProductsFromAPI()
        break

      case 'fromPromAPI': 
        console.log('🌐 Using Prom API...\n')
        await populateProductsFromPromAPI()
        break
      
      default:
        console.error('Invalid population method selected')
        process.exit(1)
    }

    console.log('\n Population complete!')
  } catch (error) {
    console.error('\n❌ Population failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
    console.log('🔌 Database connection closed.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
