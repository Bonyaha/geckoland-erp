import { PrismaClient, Source } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import csv from 'csv-parser'
import { nanoid } from 'nanoid'
import { enrichWithPromIds } from './helper/mapExternalIdsProm'
import { enrichWithRozetkaIds } from './helper/mapExternalIdsRozetka'

const prisma = new PrismaClient()

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
  inStock: string
  available: string // Comes as 'true' or 'false'
  priceOld: string
  pricePromo: string
  updatedPrice: string
  currency: string
  dateModified: string
  lastSynced: string
  needsSync: string
  multilangData: string // JSON string
  categoryData: string // JSON string
  measureUnit: string
  status: string
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
    inStock: quantity,
    available: quantity > 0,
    currency: 'UAH',
    lastSynced: new Date(),
    needsSync: false,
    categoryData: row['Категорія'] ? { name: row['Категорія'] } : null,
    measureUnit: row['Од.вим.'] || 'шт',
    status: 'active',
    promQuantity: quantity,
    rozetkaQuantity: quantity,
    // Set defaults for fields not present in this CSV
    priceOld: null,
    pricePromo: null,
    updatedPrice: null,
    dateModified: null,
    multilangData: null,
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
    source: row.source as Source || Source.crm,
    externalIds: safeJsonParse(row.externalIds),
    description: row.description || null,
    mainImage: row.mainImage || null,
    // Assuming 'images' is a JSON array string like '["url1", "url2"]'
    images: safeJsonParse(row.images) || [],
    inStock: parseInt(row.inStock, 10) || 0,
    available: row.available === 'true',
    priceOld: row.priceOld ? String(row.priceOld) : null,
    pricePromo: row.pricePromo ? String(row.pricePromo) : null,
    updatedPrice: row.updatedPrice ? String(row.updatedPrice) : null,
    currency: row.currency || 'UAH',
    dateModified: row.dateModified ? new Date(row.dateModified) : null,
    lastSynced: row.lastSynced ? new Date(row.lastSynced) : new Date(),
    needsSync: row.needsSync === 'true',
    multilangData: safeJsonParse(row.multilangData),
    categoryData: safeJsonParse(row.categoryData),
    measureUnit: row.measureUnit || 'шт',
    status: row.status || 'active',
    lastPromSync: row.lastPromSync ? new Date(row.lastPromSync) : null,
    lastRozetkaSync: row.lastRozetkaSync ? new Date(row.lastRozetkaSync) : null,
    needsPromSync: row.needsPromSync === 'true',
    needsRozetkaSync: row.needsRozetkaSync === 'true',
    promQuantity: parseInt(row.promQuantity, 10) || 0,
    rozetkaQuantity: parseInt(row.rozetkaQuantity, 10) || 0,
  }
}


// --- MAIN GENERIC FUNCTION ---


async function populateProductsFromCSV(
  filePath: string,
  mapper: (row: any) => any
) {
  
  const products: any[] = []

  if (!fs.existsSync(filePath)) {
    console.error(`Error: The file was not found at ${filePath}`)
    console.error(
      'Please place your products.csv file in the geckoland-erp/server/prisma/data/ directory.'
    )
    return
  }

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row: any) => {
      // Use the provided mapper to transform the row
      const product = mapper(row)
      if (product) {
        products.push(product)
      }
    })
    .on('end', async () => {
      try {
        console.log(`Found ${products.length} products in the CSV file.`)

        if (products.length > 0) {
          console.log('Enriching products with Prom IDs...')
          let enrichedProducts = await enrichWithPromIds(products)

          console.log('Enriching products with Rozetka IDs...')
          enrichedProducts = await enrichWithRozetkaIds(enrichedProducts)

          console.log('Clearing the Products table...')
          await prisma.products.deleteMany({})

          console.log('Populating the Products table...')

          // Insert products one by one to handle Decimal types properly
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
            `Successfully inserted ${successCount} out of ${products.length} products.`
          )
        }
      } catch (error) {
        console.error('An error occurred during the database operation:', error)
      } finally {
        await prisma.$disconnect()
      }
    })
}

// --- CONTROLLER TO RUN THE POPULATION ---

async function main() {
  // Choose which file to process here
  const fileToProcess: 'fromHP' | 'fromDB' = 'fromHP'

  if (fileToProcess === 'fromHP') {
    const csvFilePath = path.join(__dirname, 'data', 'products.csv')
    await populateProductsFromCSV(csvFilePath, mapHPCsvToProduct)
  } else if (fileToProcess === 'fromDB') {
    const csvFilePath = path.join(__dirname, 'data', 'productsFromDB.csv')
    await populateProductsFromCSV(csvFilePath, mapDbCsvToProduct)
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
