// server/prisma/scripts/populateDB.ts

import prisma, {Prisma} from '../../src/config/database'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import csv from 'csv-parser'
import { fetchCRMProducts } from '../../src/services/data-fetchers/fetchCRMProducts'
import { fetchPromProductsWithTransformation } from '../../src/services/data-fetchers/fetchPromProducts'
import { fetchRozetkaProductsWithTransformation } from '../../src/services/data-fetchers/fetchRozetkaProducts'

import {
  mapHPCsvToProduct,
  mapDbCsvToProduct,
} from '../../src/utils/helpers/mapCsvProductToEnriched'

import { mapPromProductToEnriched } from '../../src/utils/helpers/mapPromProductToEnriched'

import type {
  EnrichedProductData,
  PromProductData,
  RozetkaProductData,
} from '../../src/types/products'

// ============================================================
// CONFIGURATION
// ============================================================

type PopulationMethod = 'fromHP_CSV' | 'fromDB_CSV' | 'fromAPI' | 'fromPromAPI'

const VALID_METHODS: PopulationMethod[] = [
  'fromHP_CSV',
  'fromDB_CSV',
  'fromAPI',
  'fromPromAPI',
]

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))

const dataDirectory = path.resolve(scriptDirectory, '../data')

const syncTime = new Date()

// ============================================================
// TYPES
// ============================================================

type ProductRecord = Record<string, any>

type ProductIndexes = {
  byProductId: Map<string, ProductRecord>
  byPromId: Map<string, ProductRecord>
  byRozetkaItemId: Map<string, ProductRecord>
  byRozetkaRzItemId: Map<string, ProductRecord>
  bySku: Map<string, ProductRecord[]>
}

// ============================================================
// GENERAL HELPERS
// ============================================================

function isValidNumber(value: unknown): boolean {
  return (
    value !== null &&
    value !== undefined &&
    value !== '' &&
    Number.isFinite(Number(value))
  )
}

function normalizeQuantity(value: unknown): number {
  if (!isValidNumber(value)) return 0

  return Math.max(0, Math.trunc(Number(value)))
}

function normalizePrice(value: unknown): string {
  if (!isValidNumber(value)) return '0.00'

  const price = Number(value)

  if (price < 0) return '0.00'

  return String(value)
}

function normalizeString(value: unknown): string | null {
  if (value === null || value === undefined) return null

  const result = String(value).trim()

  return result.length > 0 ? result : null
}

function mergeCategoryData(
  current: unknown,
  marketplace: 'prom' | 'rozetka',
  category: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!category) {
    return current && typeof current === 'object' && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : null
  }

  const existing =
    current && typeof current === 'object' && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {}

  return {
    ...existing,
    [marketplace]: category,
  }
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value

  return ['true', '1', 'yes'].includes(
    String(value ?? '')
      .trim()
      .toLowerCase(),
  )
}

// ============================================================
// CSV READER
// ============================================================

async function readProductsFromCSV<T>(
  filePath: string,
  mapper: (row: any) => T | null,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      console.error(`Error: The file was not found at ${filePath}`)
      reject(
        new Error(
          `CSV file not found: ${filePath}\n` +
            `Expected location: ${dataDirectory}`,
        ),
      )
      return
    }

    const products: T[] = []

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row: Record<string, string>) => {
        try {
          const product = mapper(row)

          if (product) {
            products.push(product)
          }
        } catch (error) {
          reject(error)
        }
      })
      .on('end', () => {
        console.log(`📄 CSV products read: ${products.length}`)
        resolve(products)
      })
      .on('error', reject)
  })
}

// ============================================================
// PRODUCT INDEXES
// ============================================================

function buildProductIndexes(products: ProductRecord[]): ProductIndexes {
  const indexes: ProductIndexes = {
    byProductId: new Map(),
    byPromId: new Map(),
    byRozetkaItemId: new Map(),
    byRozetkaRzItemId: new Map(),
    bySku: new Map(),
  }

  for (const product of products) {
    indexes.byProductId.set(product.productId, product)

    if (product.promId) {
      indexes.byPromId.set(String(product.promId), product)
    }

    if (product.rozetkaItemId) {
      indexes.byRozetkaItemId.set(String(product.rozetkaItemId), product)
    }

    if (product.rozetkaRzItemId) {
      indexes.byRozetkaRzItemId.set(String(product.rozetkaRzItemId), product)
    }

    if (product.sku) {
      const sku = String(product.sku).trim()

      const matches = indexes.bySku.get(sku) ?? []

      matches.push(product)

      indexes.bySku.set(sku, matches)
    }
  }

  return indexes
}

function rememberProduct(
  product: ProductRecord,
  indexes: ProductIndexes,
): void {
  indexes.byProductId.set(product.productId, product)

  if (product.promId) {
    indexes.byPromId.set(String(product.promId), product)
  }

  if (product.rozetkaItemId) {
    indexes.byRozetkaItemId.set(String(product.rozetkaItemId), product)
  }

  if (product.rozetkaRzItemId) {
    indexes.byRozetkaRzItemId.set(String(product.rozetkaRzItemId), product)
  }

  if (product.sku) {
    const sku = String(product.sku).trim()

    const matches = indexes.bySku.get(sku) ?? []

    if (!matches.some((item) => item.productId === product.productId)) {
      matches.push(product)
      indexes.bySku.set(sku, matches)
    }
  }
}

// ============================================================
// PRODUCT MATCHING
// ============================================================

function findExistingProduct(
  incoming: ProductRecord,
  indexes: ProductIndexes,
): ProductRecord | undefined {
  if (!incoming.sku) return undefined

  const sku = String(incoming.sku).trim()

  const matches = indexes.bySku.get(sku) ?? []

  const incomingCategory = incoming.categoryData?.prom?.name

  return matches.find(
    (product) => product.categoryData?.prom?.name === incomingCategory,
  )
}

// ============================================================
// MARKETPLACE ENRICHMENT
// ============================================================

function buildSkuMap<T extends { sku?: string | null }>(
  products: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>()

  for (const product of products) {
    if (!product.sku) continue

    const sku = String(product.sku).trim()

    const matches = map.get(sku) ?? []

    matches.push(product)

    map.set(sku, matches)
  }

  return map
}

/**
 * Adds marketplace identifiers and category information to products.
 *
 * This does not replace the product's main name, price or stock quantity.
 * Those fields remain owned by the selected import source.
 */
function enrichProductsWithMarketplaces(
  products: ProductRecord[],
  promProducts: PromProductData[],
  rozetkaProducts: RozetkaProductData[],
): ProductRecord[] {
  const promBySku = buildSkuMap(promProducts)
  const rozetkaBySku = buildSkuMap(rozetkaProducts)

  let promMatches = 0
  let rozetkaMatches = 0


  const enriched = products.map((product) => {
    const result: ProductRecord = { ...product }

      if (result.sku) {
      const sku = String(result.sku).trim()

      // Prom enrichment.
      const promMatchesForSku = promBySku.get(sku) ?? []
      if (promMatchesForSku.length === 1) {
        const promProduct = promMatchesForSku[0]

        result.promId =
          result.promId ?? promProduct.promId ?? promProduct.productId

        result.promQuantity = normalizeQuantity(promProduct.stockQuantity)

        const group = promProduct.categoryData?.group

        const categoryId = group?.id ?? promProduct.categoryData?.id

        const categoryName =
          group?.name_multilang?.uk ??
          group?.name ??
          promProduct.categoryData?.caption

        if (categoryId && categoryName) {
          result.categoryData = mergeCategoryData(result.categoryData, 'prom', {
            id: Number(categoryId),
            name: String(categoryName),
          })
        }

        if (!result.description && promProduct.description) {
          result.description = promProduct.description
        }

        promMatches++
      }

      // Rozetka enrichment.
      const rozetkaMatchesForSku = rozetkaBySku.get(sku) ?? []

      if (rozetkaMatchesForSku.length === 1) {
        const rozetkaProduct = rozetkaMatchesForSku[0]

        result.rozetkaItemId =
          result.rozetkaItemId ?? rozetkaProduct.rozetkaItemId ?? null

        result.rozetkaRzItemId =
          result.rozetkaRzItemId ??
          rozetkaProduct.rozetkaRzItemId
          ?? null

        result.rozetkaQuantity = normalizeQuantity(rozetkaProduct.stockQuantity)

        const categoryId = rozetkaProduct.categoryData?.id
        const categoryName = rozetkaProduct.categoryData?.title

        if (categoryId && categoryName) {
          result.categoryData = mergeCategoryData(
            result.categoryData,
            'rozetka',
            {
              id: Number(categoryId),
              name: String(categoryName),
            },
          )
        }

        rozetkaMatches++
      }
    } 

    return result
  })

  return enriched 
}

// ============================================================
// PRODUCT DATA NORMALIZATION
// ============================================================

const PRODUCT_FIELDS = [
  'sku',
  'name',
  'price',
  'stockQuantity',
  'promId',
  'rozetkaItemId',
  'rozetkaRzItemId',
  'description',
  'mainImage',
  'images',
  'available',
  'priceOld',
  'pricePromo',
  'updatedPrice',
  'currency',
  'dateModified',
  'lastSynced',
  'needsSync',
  'categoryData',
  'measureUnit',
  'lastPromSync',
  'lastRozetkaSync',
  'needsPromSync',
  'needsRozetkaSync',
  'promQuantity',
  'rozetkaQuantity',
  'costPrice',
] as const

function buildDatabaseData(
  incoming: ProductRecord,
  current?: ProductRecord,
): ProductRecord {
  const data: ProductRecord = {}

  for (const field of PRODUCT_FIELDS) {
    if (incoming[field] !== undefined) {
      data[field] = incoming[field]
    }
  }

  // Required fields and safe defaults for new records.
  if (!current) {
    data.name = data.name || 'Unnamed Product'
    data.price = normalizePrice(data.price)
    data.stockQuantity = normalizeQuantity(data.stockQuantity)
    data.images = Array.isArray(data.images) ? data.images : []
    data.available = Boolean(data.available)
    data.needsSync = data.needsSync ?? false
    data.needsPromSync = data.needsPromSync ?? false
    data.needsRozetkaSync = data.needsRozetkaSync ?? false
    data.currency = data.currency ?? 'UAH'
    data.measureUnit = data.measureUnit ?? 'шт.'
    data.lastSynced = data.lastSynced ?? syncTime
  } else {
    // Preserve fields that were not supplied by the selected source.
    if (data.price !== undefined) {
      data.price = normalizePrice(data.price)
    }

    if (data.stockQuantity !== undefined) {
      data.stockQuantity = normalizeQuantity(data.stockQuantity)
    }

    if (data.images !== undefined && !Array.isArray(data.images)) {
      data.images = current.images ?? []
    }
  }

  // Never erase marketplace identifiers with null values from CSV mappers.
  for (const field of ['promId', 'rozetkaItemId', 'rozetkaRzItemId']) {
    if (data[field] === null && current?.[field]) {
      delete data[field]
    }
  }

  // Preserve local cost price unless the import actually supplies it.
  if (incoming.costPrice === undefined && current) {
    delete data.costPrice
  }

  return data
}

// ============================================================
// MISSING MARKETPLACE LISTINGS
// ============================================================

/**
 * Updates marketplace quantities for listings missing from a successfully
 * fetched catalogue. It never deletes a product.
 *
 * Products without marketplace identifiers are left untouched.
 */
async function markMissingMarketplaceListings(
  tx: any,
  promProducts: PromProductData[],
  rozetkaProducts: RozetkaProductData[],
): Promise<number> {
  const promIds = new Set(
    promProducts.map((product) => String(product.promId ?? product.productId)),
  )

  const rozetkaItemIds = new Set(
    rozetkaProducts
      .map((product) => product.rozetkaItemId)
      .filter((id): id is NonNullable<typeof id> => id != null)
      .map(String),
  )

  const rozetkaRzItemIds = new Set(
    rozetkaProducts
      .map((product) => product.rozetkaRzItemId)
      .filter((id): id is NonNullable<typeof id> => id != null)
      .map(String),
  )

  const products = await tx.products.findMany()

  let markedCount = 0

  for (const product of products) {
    const hasPromId = Boolean(product.promId)

   const hasRozetkaItemId = Boolean(product.rozetkaItemId)
   const hasRozetkaRzItemId = Boolean(product.rozetkaRzItemId)
   const hasRozetkaId = hasRozetkaItemId || hasRozetkaRzItemId

    const promExists = hasPromId && promIds.has(String(product.promId))

    

    const rozetkaExists =
      (hasRozetkaItemId && rozetkaItemIds.has(String(product.rozetkaItemId))) ||
      (hasRozetkaRzItemId &&
        rozetkaRzItemIds.has(String(product.rozetkaRzItemId)))

    let promQuantity = product.promQuantity
    let rozetkaQuantity = product.rozetkaQuantity
    let changed = false

    if (promProducts.length > 0 && hasPromId && !promExists) {
      promQuantity = 0
      changed = true
    }

    if (rozetkaProducts.length > 0 && hasRozetkaId && !rozetkaExists) {
      rozetkaQuantity = 0
      changed = true
    }

    if (!changed) continue

    // Prom is the primary stock source when a Prom listing exists.
    // If the Prom listing disappeared but Rozetka remains, use its quantity.
    let stockQuantity = product.stockQuantity

    if (hasPromId && !promExists) {
      stockQuantity = rozetkaExists ? normalizeQuantity(rozetkaQuantity) : 0
    } else if (!hasPromId && hasRozetkaId && !rozetkaExists) {
      stockQuantity = 0
    }

    await tx.products.update({
      where: { productId: product.productId },
      data: {
        promQuantity,
        rozetkaQuantity,
        stockQuantity,
        available: stockQuantity > 0,
        lastSynced: syncTime,
      },
    })

    markedCount++
  }

  return markedCount
}

// ============================================================
// SAFE CATALOGUE SYNCHRONIZATION
// ============================================================

async function synchronizeProducts(
  incomingProducts: ProductRecord[],
  method: PopulationMethod,
  promProducts: PromProductData[] = [],
  rozetkaProducts: RozetkaProductData[] = [],
): Promise<void> {
  if (incomingProducts.length === 0) {
    throw new Error(
      'The selected source returned zero products. Database was not changed.',
    )
  }

  console.log(`\n📦 Products to synchronize: ${incomingProducts.length}`)

  // Enrich HP/CSV data with marketplace identifiers when API catalogues
  // were fetched successfully.
  const products =
    promProducts.length > 0 || rozetkaProducts.length > 0
      ? enrichProductsWithMarketplaces(
          incomingProducts,
          promProducts,
          rozetkaProducts,
        )
      : incomingProducts

  const existingProducts = await prisma.products.findMany()
 
  const indexes = buildProductIndexes(existingProducts)

  let createdCount = 0
  let updatedCount = 0

  await prisma.$transaction(
    async (tx) => {
      for (const incoming of products) {
        const current = findExistingProduct(incoming, indexes)

        const data = buildDatabaseData(incoming, current)

        if (current) {
          const updated = await tx.products.update({
            where: {
              productId: current.productId,
            },
            data,
          })

          rememberProduct(updated, indexes)

          updatedCount++
        } else {
           const createData = {
             ...data,
             name: data.name ?? 'Unnamed Product',
             price: data.price ?? '0.00',
             stockQuantity: data.stockQuantity ?? 0,
             available: data.available ?? false,
           } satisfies Prisma.ProductsUncheckedCreateInput

           const created = await tx.products.create({
             data: createData,
           })

          rememberProduct(created, indexes)

          createdCount++
        }
      }

      // Do not interpret an empty marketplace response as a full catalogue
      // removal. The fetchers are expected to return complete, non-empty
      // catalogues for the methods that use marketplace enrichment.
      let markedMissingCount = 0

      if (promProducts.length > 0 || rozetkaProducts.length > 0) {
        markedMissingCount = await markMissingMarketplaceListings(
          tx,
          promProducts,
          rozetkaProducts,
        )
      }

      console.log('\n✅ Synchronization summary:')
      console.log(`   Created: ${createdCount}`)
      console.log(`   Updated: ${updatedCount}`)
      console.log(
        `   Marked missing marketplace listings: ${markedMissingCount}`,
      )
    },
    {
      maxWait: 10_000,
      timeout: 120_000,
    },
  )

  console.log('\n✅ Product catalogue synchronization completed.')
}

// ============================================================
// SOURCE METHODS
// ============================================================

/**
 * fromHP_CSV – products.csv from HugeProfit CRM export.
 */
async function populateProductsFromHPCSV(): Promise<void> {
  const filePath = path.join(dataDirectory, 'products.csv')

  console.log('📄 Reading HugeProfit CSV...')

  const products = await readProductsFromCSV(filePath, mapHPCsvToProduct)

  console.log('🌐 Fetching marketplace catalogues for enrichment...')

  const [promProducts, rozetkaProducts] = await Promise.all([
    fetchPromProductsWithTransformation(),
    fetchRozetkaProductsWithTransformation(),
  ])

  if (promProducts.length === 0 || rozetkaProducts.length === 0) {
    throw new Error(
      'Marketplace enrichment returned an empty catalogue. Import cancelled.',
    )
  }

  await synchronizeProducts(
    products,
    'fromHP_CSV',
    promProducts,
    rozetkaProducts,
  )
}

/**
 * fromDB_CSV – productsFromDB.csv exported from the existing database.
 *
 * This method does not require marketplace API access. It restores the
 * exported product fields and preserves existing records not in the CSV.
 */
async function populateProductsFromDBCSV(): Promise<void> {
  const filePath = path.join(dataDirectory, 'productsFromDB.csv')

  console.log('📄 Reading database CSV export...')

  const products = await readProductsFromCSV(filePath, mapDbCsvToProduct)

  await synchronizeProducts(products, 'fromDB_CSV')
}

/**
 * fromAPI – fetch directly from HugeProfit API.
 */
async function populateProductsFromAPI(): Promise<void> {
  console.log('🌐 Fetching products from HugeProfit API...')

  const products = await fetchCRMProducts()

  if (!products.length) {
    throw new Error('HugeProfit API returned zero products. Import cancelled.')
  }

  console.log(`✅ HugeProfit products fetched: ${products.length}`)

  console.log('🌐 Fetching marketplace catalogues for enrichment...')

  const [promProducts, rozetkaProducts] = await Promise.all([
    fetchPromProductsWithTransformation(),
    fetchRozetkaProductsWithTransformation(),
  ])

  if (promProducts.length === 0 || rozetkaProducts.length === 0) {
    throw new Error(
      'Marketplace enrichment returned an empty catalogue. Import cancelled.',
    )
  }

  await synchronizeProducts(products, 'fromAPI', promProducts, rozetkaProducts)
}

/**
 * fromPromAPI – fetch directly from Prom API.
 */
async function populateProductsFromPromAPI(): Promise<void> {
  console.log('🌐 Fetching products from Prom API...')

  const promProducts = await fetchPromProductsWithTransformation()

  if (!promProducts.length) {
    throw new Error('Prom API returned zero products. Import cancelled.')
  }

  console.log(`✅ Prom products fetched: ${promProducts.length}`)

  console.log('🌐 Fetching Rozetka catalogue for enrichment...')

  const rozetkaProducts = await fetchRozetkaProductsWithTransformation()

  if (!rozetkaProducts.length) {
    throw new Error('Rozetka API returned zero products. Import cancelled.')
  }

  const products = promProducts.map(mapPromProductToEnriched)

  await synchronizeProducts(
    products,
    'fromPromAPI',
    promProducts,
    rozetkaProducts,
  )
}

// ============================================================
// MAIN
// ============================================================

async function main(): Promise<void> {
  const methodValue = process.env.METHOD || 'fromPromAPI'

  if (!VALID_METHODS.includes(methodValue as PopulationMethod)) {
    throw new Error(
      `Invalid METHOD "${methodValue}". Valid methods: ${VALID_METHODS.join(', ')}`,
    )
  }

  const method = methodValue as PopulationMethod

  console.log('==========================================')
  console.log('      PRODUCT CATALOGUE SYNCHRONIZER')
  console.log('==========================================')
  console.log(`Selected method: ${method}`)
  console.log(`Data directory: ${dataDirectory}`)

  switch (method) {
    case 'fromHP_CSV':
      await populateProductsFromHPCSV()
      break

    case 'fromDB_CSV':
      await populateProductsFromDBCSV()
      break

    case 'fromAPI':
      await populateProductsFromAPI()
      break

    case 'fromPromAPI':
      await populateProductsFromPromAPI()
      break
  }

  console.log('\n🎉 Product synchronization finished successfully.')
}

main()
  .catch((error: unknown) => {
    console.error('\n❌ Product synchronization failed:')

    if (error instanceof Error) {
      console.error(error.message)
      console.error(error.stack)
    } else {
      console.error(error)
    }

    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    console.log('🔌 Database connection closed.')
  })