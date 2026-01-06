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

/* 
  This file provides a generic way to populate the Products table in the database from CSV files or directly from HugeProfit API. It supports:
  1. products.csv from HugeProfit CRM export
  2. productsFromDB.csv exported from the existing database
  3. Fetching products directly via the HugeProfit API

  It uses mapper functions to transform each CSV row (or API response) into the format expected by Prisma and the database.
 */

// --- INTERFACES FOR EACH CSV STRUCTURE ---

interface ProductFromHPCSV {
  ID: string
  Назва: string
  Артикул: string
  Кількість: string
  Ціна: string
  'Собівр.': string
  Зображення: string
  Категорія: string
  Опис: string
  'Од.вим.': string
}

interface ProductFromDbCSV {
  productId: string
  sku: string
  name: string
  price: string
  stockQuantity: string
  source: string
  externalIds: string // Comes as a JSON string
  description: string
  mainImage: string
  images: string // Comes as a comma-separated or JSON string
  available: string // Comes as 'true' or 'false'
  priceOld: string
  pricePromo: string
  updatedPrice: string
  currency: string
  dateModified: string
  lastSynced: string
  needsSync: string
  categoryData: string // JSON string
  measureUnit: string
  lastPromSync: string
  lastRozetkaSync: string
  needsPromSync: string
  needsRozetkaSync: string
  promQuantity: string
  rozetkaQuantity: string
  costPrice: string
}

// --- MAPPER FUNCTIONS FOR EACH CSV ---

/**
 * Mapper for the 'products.csv' file from HugeProfit.
 */
function mapHPCsvToProduct(row: ProductFromHPCSV): any {
  const quantity = parseInt(row['Кількість'], 10) || 0

  const price = String(parseFloat(row['Ціна']) || '0.00')
  const costPrice = row['Собівр.'] ? String(parseFloat(row['Собівр.'])) : null

  const imageUrls = row['Зображення']
    ? row['Зображення']
        .split(',')
        .map((url) => url.trim())
        .filter((url) => url)
    : []
  const mainImage = imageUrls.length > 0 ? imageUrls[0] : null

  return {
    productId: `${row.ID}_${nanoid(6)}`,
    sku: row['Артикул'] || null,
    name: row['Назва'] || 'Unnamed Product',
    price,
    costPrice,
    stockQuantity: quantity,
    source: Source.crm, // Use the enum for type safety
    externalIds: { prom: null, rozetka: null },
    description: row['Опис'] || null,
    mainImage: imageUrls[0] || null,
    images: imageUrls,
    available: quantity > 0,
    currency: 'UAH',
    lastSynced: new Date(),
    needsSync: false,
    categoryData: row['Категорія'] ? { name: row['Категорія'] } : null,
    measureUnit: row['Од.вим.'] || 'шт',
    // Set defaults for fields not present in this CSV
    promQuantity: null,
    rozetkaQuantity: null,
    priceOld: null,
    pricePromo: null,
    updatedPrice: null,
    dateModified: new Date(),
    lastPromSync: null,
    lastRozetkaSync: null,
    needsPromSync: false,
    needsRozetkaSync: false,
  }
}

/**
 * Mapper for the 'productsFromDB.csv' file.
 */
function mapDbCsvToProduct(row: ProductFromDbCSV): any {
  // Helper to safely parse JSON strings from the CSV
  const safeJsonParse = (jsonString: string) => {
    try {
      return JSON.parse(jsonString)
    } catch {
      return null // Return null if JSON is malformed
    }
  }

  return {
    productId: row.productId,
    sku: row.sku || null,
    name: row.name || 'Unnamed Product',
    // Prisma expects Decimals as strings. The CSV already provides them.
    price: String(row.price || '0.00'),
    costPrice: row.costPrice ? String(row.costPrice) : null,
    stockQuantity: parseInt(row.stockQuantity, 10) || 0,
    source: (row.source as Source) || Source.crm,
    externalIds: safeJsonParse(row.externalIds),
    description: row.description || null,
    mainImage: row.mainImage || null,
    // Assuming 'images' is a JSON array string like '["url1", "url2"]'
    images: safeJsonParse(row.images) || [],
    available: row.available === 'true',
    priceOld: row.priceOld ? String(row.priceOld) : null,
    pricePromo: row.pricePromo ? String(row.pricePromo) : null,
    updatedPrice: row.updatedPrice ? String(row.updatedPrice) : null,
    currency: row.currency || 'UAH',
    dateModified: row.dateModified ? new Date(row.dateModified) : null,
    lastSynced: row.lastSynced ? new Date(row.lastSynced) : new Date(),
    needsSync: row.needsSync === 'true',
    categoryData: safeJsonParse(row.categoryData),
    measureUnit: row.measureUnit || 'шт',
    lastPromSync: row.lastPromSync ? new Date(row.lastPromSync) : null,
    lastRozetkaSync: row.lastRozetkaSync ? new Date(row.lastRozetkaSync) : null,
    needsPromSync: row.needsPromSync === 'true',
    needsRozetkaSync: row.needsRozetkaSync === 'true',
    promQuantity: null,
    rozetkaQuantity: null,
  }
}

// --- SHARED ENRICHMENT AND INSERT LOGIC ---

/**
 * Enriches products with external IDs and categories, then inserts them into the database.
 * This is the core logic shared by both CSV and API population methods.
 */
async function enrichAndInsertProducts(products: any[]): Promise<void> {
  console.log(`Processing ${products.length} products...`)

  if (products.length === 0) {
    console.log('No products to process.')
    return
  }

  console.log('Enriching products with Prom IDs and categories...')
  let enrichedProducts = await enrichWithPromIds(products)
  enrichedProducts = await enrichWithPromCategoriesAndDescription(
    enrichedProducts
  )

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

  console.log('Clearing the Products table...')
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

  console.log(
    `✅ Successfully inserted ${successCount} out of ${enrichedProducts.length} products.`
  )
}

// --- CSV POPULATION FUNCTION ---

/**
 * Populates the database from a CSV file using the provided mapper function.
 */
async function populateProductsFromCSV(
  filePath: string,
  mapper: (row: any) => any
): Promise<void> {
  return new Promise((resolve, reject) => {
    const products: any[] = []

    if (!fs.existsSync(filePath)) {
      console.error(`Error: The file was not found at ${filePath}`)
      console.error(
        'Please place your CSV file in the geckoland-erp/server/prisma/data/ directory.'
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

// --- CONTROLLER TO RUN THE POPULATION ---

async function main() {
  try {
    console.log('=== Product Database Population Tool ===\n')

    // Choose your population method here:
    // 'fromHP_CSV' - Use CSV export from HugeProfit
    // 'fromDB_CSV' - Use CSV export from database
    // 'fromAPI'    - Fetch directly from HugeProfit API

    const populationMethod = 'fromAPI' as
      | 'fromHP_CSV'
      | 'fromDB_CSV'
      | 'fromAPI'

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
          'productsFromDB.csv'
        )
        await populateProductsFromCSV(dbCsvPath, mapDbCsvToProduct)
        break

      case 'fromAPI':
        console.log('🌐 Using HugeProfit API...\n')
        await populateProductsFromAPI()
        break

      default:
        console.error('Invalid population method selected')
        process.exit(1)
    }

    console.log('\n✨ Population complete!')
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
