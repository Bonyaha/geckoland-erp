//server\src\controllers\products\productController.ts
import { Request, Response, RequestHandler } from 'express'
import prisma from '../../config/database'
import {
  updateRozetkaProduct,
  updateMultipleRozetkaProducts,
  RozetkaUpdateParams,
} from '../../services/marketplaces/rozetkaClient'
import { fetchRozetkaProductsWithTransformation } from '../../services/data-fetchers/fetchRozetkaProducts'
import {
  updatePromProduct,
  updateMultiplePromProducts,
  type PromUpdateParams,
} from '../../services/marketplaces/promClient'
import { fetchPromProductsWithTransformation } from '../../services/data-fetchers/fetchPromProducts'
import {
  createMarketplaceUpdatePromise,
  createMarketplaceSyncStatus,
  normalizeQuantity,
} from '../../services/marketplaces/sync/marketplaceSyncHelpers'
import { AppError, ErrorFactory } from '../../middleware/errorHandler'

export const getProducts = async (
  req: Request,
  res: Response
): Promise<void> => {
  const search = req.query.search?.toString()
  const products = await prisma.products.findMany({
    where: {
      name: {
        contains: search,
      },
    },
  })
  res.json(products)

  if (!products) {
    throw ErrorFactory.notFound('Error retrieving products')
  }
}

export const createProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  const {
    productId,
    name,
    price,
    stockQuantity,
    sku,
    source = 'prom', // Default from schema
    externalIds = {}, // Default for Json field
    description,
    mainImage,
    images = [], // Default for String[] field
    available,
    priceOld,
    pricePromo,
    updatedPrice,
    currency,
    sellingType,
    presence,
    dateModified,
    lastSynced,
    needsSync = false, // Default from schema
    multilangData,
    categoryData,
    measureUnit,
    status,
  } = req.body

  // Validate required fields
  if (
    !productId ||
    !name ||
    price === undefined ||
    stockQuantity === undefined
  ) {
    throw ErrorFactory.validationError(
      'productId, name, price, and stockQuantity are required'
    )
  }

  const product = await prisma.products.create({
    data: {
      productId,
      name,
      price,
      stockQuantity,
      sku,
      source,
      externalIds,
      description,
      mainImage,
      images,
      available,
      priceOld,
      pricePromo,
      updatedPrice,
      currency,
      dateModified,
      lastSynced,
      needsSync,
      categoryData,
      measureUnit,
    },
  })
  if (!product) {
    throw ErrorFactory.internal('Error creating product')
  }
  res.status(201).json(product)
}

interface ProductUpdateParams {
  quantity?: number
  price?: number
  // Add more fields as needed
}

interface BatchProductUpdate {
  productId: string
  updates: ProductUpdateParams
}

//Function to update product in the app and immediately sync with marketplaces
//updating quantity and price in marketplaces through app (app db → Prom/Rozetka)

/* export const updateProduct = async (req: Request, res: Response) => {
console.log('I am in old updating funcion');

  const { productId } = req.params
  const updates: ProductUpdateParams = {}

  // Extract update parameters from request body
  if (req.body.quantity !== undefined) updates.quantity = req.body.quantity
  if (req.body.price !== undefined) updates.price = req.body.price

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ message: 'No valid update parameters provided' })
    return
  }

  try {
    // Prepare database update data
    const dbUpdateData: any = {
      needsSync: true,
      lastSynced: new Date(),
    }

    if (updates.quantity !== undefined) {
      dbUpdateData.stockQuantity = updates.quantity
    }

    if (updates.price !== undefined) {
      dbUpdateData.price = updates.price
    }

    console.log(`Updating product ${productId} with data:`, dbUpdateData)

    // Update app database
    const product = await prisma.products.update({
      where: { productId },
      data: dbUpdateData,
    })

    // Handle external marketplace updates
    const syncPromises: Promise<any>[] = []
    const syncResults: string[] = []

    // Helper function to handle marketplace sync with unified error handling and logging
    const createMarketplaceUpdatePromise = async (
      marketplaceName: string,
      productId: string,
      updateFunction: () => Promise<any>
    ) => {
      try {
        await updateFunction()
        syncResults.push(marketplaceName)
        console.log(
          `✅ ${marketplaceName} product ${productId} updated successfully`
        )
      } catch (error) {
        console.error(
          `Failed to update ${marketplaceName} product ${productId}:`,
          error
        )
      }
    }

    if (
      product.externalIds &&
      typeof product.externalIds === 'object' &&
      !Array.isArray(product.externalIds)
    ) {
      const externalIds = product.externalIds as Record<string, any>

      // Update Prom if ID exists
      if (externalIds.prom && typeof externalIds.prom === 'string') {
        const promUpdates: any = {}
        if (updates.quantity !== undefined)
          promUpdates.quantity = updates.quantity
        if (updates.price !== undefined) promUpdates.price = updates.price

        syncPromises.push(
          createMarketplaceUpdatePromise('Prom', productId, () =>
            updatePromProduct(externalIds.prom, promUpdates)
          )
        )
      }

      // Update Rozetka if ID exists
      if (
        externalIds.rozetka &&
        typeof externalIds.rozetka === 'object' &&
        externalIds.rozetka.item_id &&
        typeof externalIds.rozetka.item_id === 'string'
      ) {
        const rozetkaUpdates: any = {}
        if (updates.quantity !== undefined)
          rozetkaUpdates.quantity = updates.quantity
        if (updates.price !== undefined) rozetkaUpdates.price = updates.price

        syncPromises.push(
          createMarketplaceUpdatePromise('Rozetka', productId, () =>
            updateRozetkaProduct(externalIds.rozetka.item_id, rozetkaUpdates)
          )
        )
      }
    }

    // Execute all marketplace updates in parallel
    if (syncPromises.length > 0) {
      await Promise.allSettled(syncPromises)
    }

    // Mark sync complete
    await prisma.products.update({
      where: { productId },
      data: { needsSync: false },
    })

    res.json({
      message: 'Product updated and synced successfully',
      updates: updates,
      syncedMarketplaces: syncResults,
      totalMarketplaces: syncPromises.length,
    })
  } catch (error) {
    console.error('Product update error:', error)
    res.status(500).json({ message: 'Failed to update product' })
  }
} */

/**
 * Update single or multiple products in the app and sync with marketplaces
 *
 * Single product update (existing behavior):
 * PUT /products/:productId
 * Body: { quantity?: number, price?: number }
 *
 * Batch product update (new behavior):
 * PUT /products/batch
 * Body: { products: [{ productId: string, updates: { quantity?: number, price?: number } }] }
 */
export const updateProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { productId } = req.params
  if (!productId) {
    throw ErrorFactory.validationError('productId is required in params')
  }

  // Check if this is a batch update
  const isBatchUpdate = productId === 'batch' && req.body.products

  if (isBatchUpdate) {
    await handleBatchUpdate(req, res)
  } else {
    await handleSingleUpdate(req, res, productId)
  }
}

async function handleSingleUpdate(
  req: Request,
  res: Response,
  productId: string
) {
  console.log('productId is:', productId)

  const {
    targetMarketplace,
  }: { targetMarketplace?: 'prom' | 'rozetka' | 'all' } = req.body
  const updates: ProductUpdateParams = {}

  if (
    req.body.quantity !== undefined &&
    (typeof req.body.quantity !== 'number' || req.body.quantity < 0)
  ) {
    throw ErrorFactory.validationError('quantity must be a non-negative number')
  }
  if (
    req.body.price !== undefined &&
    (typeof req.body.price !== 'number' || req.body.price < 0)
  ) {
    throw ErrorFactory.validationError('price must be a non-negative number')
  }

  if (req.body.quantity !== undefined) updates.quantity = req.body.quantity
  if (req.body.price !== undefined) updates.price = req.body.price

  if (Object.keys(updates).length === 0) {
    throw ErrorFactory.validationError('No valid update parameters provided')
  }
  // First, get the current product to save old price
  const currentProduct = await prisma.products.findUnique({
    where: { productId },
    select: { price: true, stockQuantity: true, externalIds: true },
  })

  if (!currentProduct) {
    throw ErrorFactory.notFound(`Product ${productId} not found`)
  }

  const now = new Date()
  const dbUpdateData: any = {
    needsSync: true,
    lastSynced: now,
    dateModified: now,
  }

  // If updating all sides (default)
  if (!targetMarketplace || targetMarketplace === 'all') {
    if (updates.quantity !== undefined) {
      dbUpdateData.stockQuantity = updates.quantity
    }
    if (updates.price !== undefined) {
      if (currentProduct.price !== null && currentProduct.price !== undefined) {
        dbUpdateData.priceOld = currentProduct.price
      }
      dbUpdateData.price = updates.price
      dbUpdateData.updatedPrice = updates.price
    }

    console.log(`Updating product ${productId} in DB with:`, dbUpdateData)

    await prisma.products.update({
      where: { productId },
      data: dbUpdateData,
    })
  } else {
    // If updating only one marketplace, ensure quantity <= warehouse
    if (
      updates.quantity !== undefined &&
      updates.quantity > currentProduct.stockQuantity
    ) {
      throw ErrorFactory.badRequest(
        'You cannot change quantity bigger than there is in warehouse!'
      )
    }
  }

  // Marketplace sync setup
  const syncResults: string[] = []
  const syncErrors: Array<{ marketplace: string; error: string }> = []
  const syncPromises: Promise<any>[] = []

  // Track which marketplaces were successfully synced
  const syncStatus = createMarketplaceSyncStatus()

  const externalIds = currentProduct.externalIds as Record<string, any> | null

  // Prom update
  if (
    (!targetMarketplace ||
      targetMarketplace === 'all' ||
      targetMarketplace === 'prom') &&
    externalIds?.prom
  ) {
    console.log('target is Prom')

    const promUpdates: any = {}
    if (updates.quantity !== undefined) promUpdates.quantity = updates.quantity
    if (updates.price !== undefined) promUpdates.price = updates.price

    syncPromises.push(
      createMarketplaceUpdatePromise({
        marketplaceName: 'Prom',
        productId,
        updateFunction: () => updatePromProduct(externalIds.prom, promUpdates),
        onSuccess: () => (syncStatus.promSynced = true),
        resultsArray: syncResults,
        errorsArray: syncErrors,
      })
    )
  }

  // Rozetka update
  if (
    (!targetMarketplace ||
      targetMarketplace === 'all' ||
      targetMarketplace === 'rozetka') &&
    externalIds?.rozetka?.item_id
  ) {
    const rozetkaUpdates: any = {}
    if (updates.quantity !== undefined)
      rozetkaUpdates.quantity = updates.quantity
    if (updates.price !== undefined) rozetkaUpdates.price = updates.price

    syncPromises.push(
      createMarketplaceUpdatePromise({
        marketplaceName: 'Rozetka',
        productId,
        updateFunction: () =>
          updateRozetkaProduct(externalIds.rozetka.item_id, rozetkaUpdates),
        onSuccess: () => (syncStatus.rozetkaSynced = true),
        resultsArray: syncResults,
        errorsArray: syncErrors,
      })
    )
  }

  // Execute parallel updates
  if (syncPromises.length > 0) {
    await Promise.allSettled(syncPromises)
  }

  // Mark sync complete and update marketplace-specific fields
  // 1. Finalize DB update with sync status
  const finalUpdateData: any = {}
  const syncTime = new Date()

  console.log(`syncStatus.promSynced`, syncStatus.promSynced)

  // Update Prom-specific fields if Prom was successfully synced
  if (syncStatus.promSynced) {
    finalUpdateData.lastPromSync = syncTime
    if (updates.quantity !== undefined) {
      // Only update quantity if it was provided
      finalUpdateData.promQuantity = updates.quantity
    }
  }

  // Update Rozetka-specific fields if Rozetka was successfully synced
  if (syncStatus.rozetkaSynced) {
    finalUpdateData.lastRozetkaSync = syncTime
    if (updates.quantity !== undefined) {
      // Only update quantity if it was provided
      finalUpdateData.rozetkaQuantity = updates.quantity
    }
  }

  if (syncErrors.length === 0) {
    finalUpdateData.needsSync = false
  }
  console.log(`finalUpdateData`, finalUpdateData)

  if (Object.keys(finalUpdateData).length > 0) {
    await prisma.products.update({
      where: { productId },
      data: finalUpdateData,
    })
  }

  // 2. Send response based on outcome
  if (syncErrors.length > 0) {
    // PARTIAL OR TOTAL FAILURE
    const message = `Product update processed${
      targetMarketplace ? ' for ' + targetMarketplace : ''
    }, but with sync errors.`

    return res.status(207).json({
      // HTTP 207 Multi-Status
      message,
      productId,
      updates,
      syncedMarketplaces: syncResults,
      errors: syncErrors,
    })
  } else {
    // FULL SUCCESS
    const message = `Product updated${
      targetMarketplace ? ' for ' + targetMarketplace : ' and synced everywhere'
    } successfully.`

    return res.json({
      message,
      productId,
      updates,
      syncedMarketplaces: syncResults,
      errors: undefined,
    })
  }
}

async function handleBatchUpdate(req: Request, res: Response) {
  const {
    products,
    targetMarketplace,
  }: {
    products: BatchProductUpdate[]
    targetMarketplace?: 'prom' | 'rozetka' | 'all'
  } = req.body

  if (!Array.isArray(products) || products.length === 0) {
    throw ErrorFactory.validationError(
      'products array is required and must not be empty'
    )
  }

  // Validate each product update
  for (const item of products) {
    if (
      !item.productId ||
      !item.updates ||
      Object.keys(item.updates).length === 0
    ) {
      throw ErrorFactory.validationError(
        'Each product must have productId and at least one update field'
      )
    }
    const { quantity, price } = item.updates
    if (
      quantity !== undefined &&
      (typeof quantity !== 'number' || quantity < 0)
    ) {
      throw ErrorFactory.validationError(
        `Product ${item.productId}: quantity must be a non-negative number`
      )
    }
    if (price !== undefined && (typeof price !== 'number' || price < 0)) {
      throw ErrorFactory.validationError(
        `Product ${item.productId}: price must be a non-negative number`
      )
    }
  }
  console.log(`Starting batch update for ${products.length} products`)

  // Fetch all products first for warehouse validation
  const productIds = products.map((p) => p.productId)
  const dbProducts = await prisma.products.findMany({
    where: { productId: { in: productIds } },
    select: {
      productId: true,
      stockQuantity: true,
      externalIds: true,
    },
  })

  const dbMap = new Map(dbProducts.map((p) => [p.productId, p]))

  // Warehouse validation if only one marketplace is targeted
  if (targetMarketplace && targetMarketplace !== 'all') {
    for (const { productId, updates } of products) {
      if (updates.quantity !== undefined) {
        const dbProduct = dbMap.get(productId)
        if (!dbProduct) continue
        if (updates.quantity > dbProduct.stockQuantity) {
          throw ErrorFactory.badRequest(
            `Product ${productId}: You cannot change quantity bigger than there is in warehouse!`
          )
        }
      }
    }
  }

  // Case 1: Update DB first (if updating everywhere)
  let dbResults: PromiseSettledResult<any>[] = []

  if (!targetMarketplace || targetMarketplace === 'all') {
    const dbUpdatePromises = products.map((item) =>
      prisma.products.update({
        where: { productId: item.productId },
        data: {
          needsSync: true,
          lastSynced: new Date(),
          ...(item.updates.quantity !== undefined && {
            stockQuantity: item.updates.quantity,
          }),
          ...(item.updates.price !== undefined && {
            price: item.updates.price,
          }),
        },
      })
    )
    dbResults = await Promise.allSettled(dbUpdatePromises)
  } else {
    // Skip DB updates for marketplace-only operations
    dbResults = products.map((item) => ({
      status: 'fulfilled',
      value: dbMap.get(item.productId),
    })) as PromiseFulfilledResult<any>[]
  }
  console.log('dbResults', dbResults)

  // Track DB update results
  const successfulUpdates: string[] = []
  const failedUpdates: Array<{ productId: string; error: string }> = []
  dbResults.forEach((result, index) =>
    result.status === 'fulfilled'
      ? successfulUpdates.push(products[index].productId)
      : failedUpdates.push({
          productId: products[index].productId,
          error: result.reason?.message || 'Unknown error',
        })
  )

  console.log(
    `Database updates: ${successfulUpdates.length} successful, ${failedUpdates.length} failed`
  )

  // 2️⃣ Collect marketplace updates
  const promUpdates: Array<{ productId: string; updates: PromUpdateParams }> =
    []
  const rozetkaUpdates: Array<{ productId: string; updates: any }> = []

  for (const result of dbResults) {
    if (result.status !== 'fulfilled') continue

    const product = result.value
    const original = products.find((p) => p.productId === product.productId)
    if (!original) continue

    const externalIds = product.externalIds as Record<string, any> | null

    // Collect Prom updates
    if (
      (!targetMarketplace ||
        targetMarketplace === 'all' ||
        targetMarketplace === 'prom') &&
      externalIds?.prom
    ) {
      const promParams: PromUpdateParams = {}
      if (original.updates.quantity !== undefined)
        promParams.quantity = original.updates.quantity
      if (original.updates.price !== undefined)
        promParams.price = original.updates.price

      promUpdates.push({
        productId: externalIds.prom,
        updates: promParams,
      })
    }

    // Collect Rozetka updates
    if (
      (!targetMarketplace ||
        targetMarketplace === 'all' ||
        targetMarketplace === 'rozetka') &&
      externalIds?.rozetka?.item_id
    ) {
      const rozetkaParams: RozetkaUpdateParams = {}
      if (original.updates.quantity !== undefined)
        rozetkaParams.quantity = original.updates.quantity
      if (original.updates.price !== undefined)
        rozetkaParams.price = original.updates.price

      rozetkaUpdates.push({
        productId: externalIds.rozetka.item_id,
        updates: rozetkaParams,
      })
    }
  }

  // 3️⃣ Sync to marketplaces
  const syncResults: string[] = []
  const syncErrors: Array<{ marketplace: string; error: string }> = []
  const syncStatus = createMarketplaceSyncStatus()
  const syncPromises: Promise<void>[] = []

  // Batch update Prom products
  if (promUpdates.length > 0) {
    syncPromises.push(
      createMarketplaceUpdatePromise({
        marketplaceName: 'Prom',
        count: promUpdates.length,
        updateFunction: () => updateMultiplePromProducts(promUpdates),
        onSuccess: () => (syncStatus.promSynced = true),
        resultsArray: syncResults,
        errorsArray: syncErrors,
        isBatch: true,
      })
    )
  }

  // Batch update Rozetka products
  if (rozetkaUpdates.length > 0) {
    syncPromises.push(
      createMarketplaceUpdatePromise({
        marketplaceName: 'Rozetka',
        count: rozetkaUpdates.length,
        updateFunction: () => updateMultipleRozetkaProducts(rozetkaUpdates),
        onSuccess: () => (syncStatus.rozetkaSynced = true),
        resultsArray: syncResults,
        errorsArray: syncErrors,
        isBatch: true,
      })
    )
  }

  await Promise.allSettled(syncPromises)

  // 4️⃣ Mark DB as synced
  const syncTime = new Date()
  const markSyncedPromises = successfulUpdates.map((productId) => {
    const data: any = { needsSync: false }
    if (syncStatus.promSynced) {
      data.lastPromSync = syncTime
    }
    if (syncStatus.rozetkaSynced) {
      data.lastRozetkaSync = syncTime
    }
    return prisma.products.update({ where: { productId }, data })
  })
  await Promise.allSettled(markSyncedPromises)

  const message = `Batch update completed${
    targetMarketplace ? ' for ' + targetMarketplace : ''
  }`
  // 5️⃣ Respond
  return res.json({
    message,
    summary: {
      totalRequested: products.length,
      successfulDatabaseUpdates: successfulUpdates.length,
      failedDatabaseUpdates: failedUpdates.length,
      marketplacesSynced: syncResults,
      marketplaceErrors: syncErrors.length ? syncErrors : undefined,
    },
    details: {
      successfulProducts: successfulUpdates,
      failedProducts: failedUpdates.length > 0 ? failedUpdates : undefined,
    },
  })

  console.log(
    `✅ Batch update completed: ${successfulUpdates.length}/${products.length} products updated`
  )
}

/**
 * Create a product in database from Prom data
 */
async function createProductFromProm(promProduct: any): Promise<void> {
  try {
    await prisma.products.create({
      data: {
        ...promProduct,
        stockQuantity: normalizeQuantity(promProduct.stockQuantity),
        promQuantity: normalizeQuantity(promProduct.stockQuantity),
        lastPromSync: new Date(),
      },
    })
  } catch (error: any) {
    console.error('Error creating product from Prom:', error)
    throw ErrorFactory.internal(
      `Failed to create product from Prom: ${error.message}`
    )
  }
}

/**
 * Create a product in database from Rozetka data
 */
async function createProductFromRozetka(rozetkaProduct: any): Promise<void> {
  // Map Rozetka product structure to your Products model
  try {
    await prisma.products.create({
      data: {
        ...rozetkaProduct,
        stockQuantity: normalizeQuantity(rozetkaProduct.stockQuantity),
        promQuantity: normalizeQuantity(rozetkaProduct.stockQuantity),
        lastRozetkaSync: new Date(),
      },
    })
  } catch (error: any) {
    console.error('Error creating product from Rozetka:', error)
    throw ErrorFactory.internal(
      `Failed to create product from Rozetka: ${error.message}`
    )
  }
}

/**
 * Sync new products from marketplaces to database
 * Only creates products that don't exist in database
 */

interface SyncResult {
  success: boolean
  productsCreatedFromProm: number
  productsCreatedFromRozetka: number
  totalCreated: number
  errors: string[]
}

export async function syncNewProductsFromMarketplaces(): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    productsCreatedFromProm: 0,
    productsCreatedFromRozetka: 0,
    totalCreated: 0,
    errors: [],
  }
  console.log('🔄 Starting sync for new products from marketplaces...')

  // Step 1: Get all existing product IDs from database
  const existingProducts = await prisma.products.findMany({
    select: {
      productId: true,
      externalIds: true,
    },
  })
  if (!existingProducts) {
    throw ErrorFactory.internal(
      'Failed to fetch existing products from database'
    )
  }
  // Build sets of existing external IDs for quick lookup
  const existingPromIds = new Set<string>()
  const existingRozetkaItemIds = new Set<string>()

  existingProducts.forEach((product) => {
    const externalIds = product.externalIds as any

    // Extract Prom ID
    if (externalIds?.prom) {
      existingPromIds.add(externalIds.prom.toString())
    }

    // Extract Rozetka item_id
    if (externalIds?.rozetka?.rz_item_id) {
      existingRozetkaItemIds.add(externalIds.rozetka.rz_item_id.toString())
    }
  })

  console.log(
    `📦 Found ${existingProducts.length} existing products in database`
  )
  console.log(`   - ${existingPromIds.size} with Prom IDs`)
  console.log(`   - ${existingRozetkaItemIds.size} with Rozetka IDs`)

  // Step 2: Fetch products from Prom
  console.log('Fetching products from Prom...')
  try {
    const promProducts = await fetchPromProductsWithTransformation()
    console.log(`✅ Fetched ${promProducts.length} products from Prom`)

    // Find new products that don't exist in database
    const newPromProducts = promProducts.filter((p) => {
      const promId = p.productId.toString()
      return !existingPromIds.has(promId)
    })

    console.log(`Found ${newPromProducts.length} new products on Prom`)

    // Create new products from Prom
    for (const promProduct of newPromProducts) {
      try {
        const promId = promProduct.productId.toString()
        console.log(`Creating product from Prom: ${promId}`)
        await createProductFromProm(promProduct)
        result.productsCreatedFromProm++
        existingPromIds.add(promId) // Add to set to avoid duplicates
      } catch (error: any) {
        console.error(
          `Error creating product ${promProduct.productId} from Prom:`,
          error.message
        )
        result.errors.push(
          `Prom product ${promProduct.productId}: ${error.message}`
        )
      }
    }
  } catch (error: any) {
    console.error('Error fetching Prom products:', error.message)
    throw ErrorFactory.internal(
      `Error fetching Prom products: ${error.message}`
    )
  }

  // Step 3: Fetch products from Rozetka
  console.log('Fetching products from Rozetka...')
  try {
    const rozetkaProducts = await fetchRozetkaProductsWithTransformation()
    console.log(`Fetched ${rozetkaProducts.length} products from Rozetka`)

    // Find new products that don't exist in database
    const newRozetkaProducts = rozetkaProducts.filter((p) => {
      // Rozetka product's item_id should be compared with externalIds.rozetka.item_id from database
      const itemId = p.productId?.toString()
      return itemId && !existingRozetkaItemIds.has(itemId)
    })
    console.log(`Found ${newRozetkaProducts.length} new products on Rozetka`)

    // Create new products from Rozetka
    for (const rozetkaProduct of newRozetkaProducts) {
      try {
        const itemId = rozetkaProduct.productId?.toString()
        console.log(`Creating product from Rozetka: ${itemId}`)
        await createProductFromRozetka(rozetkaProduct)
        result.productsCreatedFromRozetka++
        if (itemId) {
          existingRozetkaItemIds.add(itemId)
        }
      } catch (error: any) {
        console.error(
          `Error creating product ${rozetkaProduct.productId} from Rozetka:`,
          error.message
        )
        result.errors.push(
          `Rozetka product ${rozetkaProduct.productId}: ${error.message}`
        )
      }
    }
  } catch (error: any) {
    console.error('Error fetching Rozetka products:', error.message)
    throw ErrorFactory.internal(
      `Error fetching Rozetka products: ${error.message}`
    )
  }

  // Calculate totals
  result.totalCreated =
    result.productsCreatedFromProm + result.productsCreatedFromRozetka

  console.log('✅ Sync completed')
  console.log('📊 Summary:', {
    createdFromProm: result.productsCreatedFromProm,
    createdFromRozetka: result.productsCreatedFromRozetka,
    totalCreated: result.totalCreated,
    errors: result.errors.length,
  })

  if (result.errors.length > 0) {
    result.success = false
  }

  return result
}

//syncNewProductsFromMarketplaces()
