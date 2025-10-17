//server\src\controllers\productController.ts
import { Request, Response, RequestHandler } from 'express'
import { PrismaClient } from '@prisma/client'
import {
  updateRozetkaProduct,
  updateMultipleRozetkaProducts,
  RozetkaUpdateParams,
} from '../services/marketplaces/rozetkaClient'
import { fetchRozetkaProductsWithTransformation } from '../../prisma/fetchRozetkaProducts'
import {
  updatePromProduct,
  updateMultiplePromProducts,
  type PromUpdateParams,
} from '../services/marketplaces/promClient'
import { fetchPromProductsWithTransformation } from '../../prisma/fetchPromProducts'
import {
  createMarketplaceUpdatePromise,
  createMarketplaceSyncStatus,
} from '../utils/marketplaceSyncHelpers'

const prisma = new PrismaClient()

export const getProducts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const search = req.query.search?.toString()
    const products = await prisma.products.findMany({
      where: {
        name: {
          contains: search,
        },
      },
    })
    res.json(products)
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving products' })
  }
}

export const createProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
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
      inStock,
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
      res.status(400).json({
        message: 'productId, name, price, and stockQuantity are required',
      })
      return
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
        inStock,
        available,
        priceOld,
        pricePromo,
        updatedPrice,
        currency,
        dateModified,
        lastSynced,
        needsSync,
        multilangData,
        categoryData,
        measureUnit,
        status,
      },
    })
    res.status(201).json(product)
  } catch (error) {
    res.status(500).json({ message: 'Error creating product' })
  }
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
export const updateProduct: RequestHandler = async (req, res) => {
  const { productId } = req.params

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

  if (req.body.quantity !== undefined) updates.quantity = req.body.quantity
  if (req.body.price !== undefined) updates.price = req.body.price

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ message: 'No valid update parameters provided' })
    return
  }

  try {
    // First, get the current product to save old price
    const currentProduct = await prisma.products.findUnique({
      where: { productId },
      select: { price: true, stockQuantity: true, externalIds: true },
    })

    if (!currentProduct) {
      res.status(404).json({ message: 'Product not found' })
      return
    }

    const now = new Date()
    const dbUpdateData: any = {
      needsSync: true,
      lastSynced: now,
      dateModified: now,
    }

    // 🧩 If updating all sides (default)
    if (!targetMarketplace || targetMarketplace === 'all') {
      if (updates.quantity !== undefined) {
        dbUpdateData.stockQuantity = updates.quantity
        dbUpdateData.inStock = updates.quantity
      }
      if (updates.price !== undefined) {
        if (
          currentProduct.price !== null &&
          currentProduct.price !== undefined
        ) {
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
      // 🧩 If updating only one marketplace, ensure quantity <= warehouse
      if (
        updates.quantity !== undefined &&
        updates.quantity > currentProduct.stockQuantity
      ) {
        res.status(400).json({
          message:
            'You cannot change quantity bigger than there is in warehouse!',
        })
        return
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
      if (updates.quantity !== undefined)
        promUpdates.quantity = updates.quantity
      if (updates.price !== undefined) promUpdates.price = updates.price

      syncPromises.push(
        createMarketplaceUpdatePromise({
          marketplaceName: 'Prom',
          productId,
          updateFunction: () =>
            updatePromProduct(externalIds.prom, promUpdates),
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
        targetMarketplace
          ? ' for ' + targetMarketplace
          : ' and synced everywhere'
      } successfully.`

      return res.json({
        message,
        productId,
        updates,
        syncedMarketplaces: syncResults,
        errors: undefined,
      })
    }
  } catch (error) {
    console.error('Product update error:', error)
    res.status(500).json({ message: 'Failed to update product' })
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
    res.status(400).json({
      message: 'products array is required and must not be empty',
    })
    return
  }

  // Validate each product update
  for (const item of products) {
    if (
      !item.productId ||
      !item.updates ||
      Object.keys(item.updates).length === 0
    ) {
      res.status(400).json({
        message:
          'Each product must have productId and at least one update field',
      })
      return
    }
  }

  try {
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
    const test = dbProducts.map((p) => [p.productId, p])
    console.log('test', test)

    const dbMap = new Map(dbProducts.map((p) => [p.productId, p]))

    // 🚫 Warehouse validation if only one marketplace is targeted
    if (targetMarketplace && targetMarketplace !== 'all') {
      for (const { productId, updates } of products) {
        if (updates.quantity !== undefined) {
          const dbProduct = dbMap.get(productId)
          if (!dbProduct) continue
          if (updates.quantity > dbProduct.stockQuantity) {
            res.status(400).json({
              message: `Product ${productId}: You cannot change quantity bigger than there is in warehouse!`,
            })
            return
          }
        }
      }
    }

    // 🧩 Case 1: Update DB first (if updating everywhere)
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

    // 5️⃣ Respond
    res.json({
      message: `Batch update completed${
        targetMarketplace ? ' for ' + targetMarketplace : ''
      }`,
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
  } catch (error) {
    console.error('Batch update error:', error)
    res.status(500).json({ message: 'Failed to complete batch update' })
  }
}

/*
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

/**
 * Normalize quantity values (handle null, undefined, negative)
 */
function normalizeQuantity(quantity: any): number {
  const num = parseInt(quantity, 10)
  return isNaN(num) || num < 0 ? 0 : num
}

/**
 * Create a product in database from Prom data
 */
async function createProductFromProm(promProduct: any): Promise<void> {
  await prisma.products.create({
    data: {
      ...promProduct,
      stockQuantity: normalizeQuantity(promProduct.stockQuantity),
      promQuantity: normalizeQuantity(promProduct.stockQuantity),
      lastPromSync: new Date(),
    },
  })
}

/**
 * Create a product in database from Rozetka data
 */
async function createProductFromRozetka(rozetkaProduct: any): Promise<void> {
  // Map Rozetka product structure to your Products model
  await prisma.products.create({
    data: {
      ...rozetkaProduct,
      stockQuantity: normalizeQuantity(rozetkaProduct.stockQuantity),
      promQuantity: normalizeQuantity(rozetkaProduct.stockQuantity),
      lastRozetkaSync: new Date(),
    },
  })
}

/**
 * Sync new products from marketplaces to database
 * Only creates products that don't exist in database
 */
export async function syncNewProductsFromMarketplaces(): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    productsCreatedFromProm: 0,
    productsCreatedFromRozetka: 0,
    totalCreated: 0,
    errors: [],
  }

  try {
    console.log('🔄 Starting sync for new products from marketplaces...')

    // Step 1: Get all existing product IDs from database
    const existingProducts = await prisma.products.findMany({
      select: { productId: true },
    })
    const existingProductIds = new Set(existingProducts.map((p) => p.productId))
    console.log(
      `📦 Found ${existingProductIds.size} existing products in database`
    )

    // Step 2: Fetch products from Prom
    console.log('📥 Fetching products from Prom...')
    try {
      const promProducts = await fetchPromProductsWithTransformation()
      console.log(`✅ Fetched ${promProducts.length} products from Prom`)

      // Find new products that don't exist in database
      const newPromProducts = promProducts.filter(
        (p) => !existingProductIds.has(p.productId)
      )
      console.log(`🆕 Found ${newPromProducts.length} new products on Prom`)

      // Create new products from Prom
      for (const promProduct of newPromProducts) {
        try {
          console.log(`➕ Creating product from Prom: ${promProduct.productId}`)
          await createProductFromProm(promProduct)
          result.productsCreatedFromProm++
          existingProductIds.add(promProduct.productId) // Add to set to avoid duplicates
        } catch (error: any) {
          console.error(
            `❌ Error creating product ${promProduct.productId} from Prom:`,
            error.message
          )
          result.errors.push(
            `Prom product ${promProduct.productId}: ${error.message}`
          )
        }
      }
    } catch (error: any) {
      console.error('❌ Error fetching Prom products:', error.message)
      result.errors.push(`Prom fetch error: ${error.message}`)
    }

    // Step 3: Fetch products from Rozetka
    console.log('📥 Fetching products from Rozetka...')
    try {
      const rozetkaProducts = await fetchRozetkaProductsWithTransformation()
      console.log(`✅ Fetched ${rozetkaProducts.length} products from Rozetka`)

      // Find new products that don't exist in database
      const newRozetkaProducts = rozetkaProducts.filter(
        (p) => !existingProductIds.has(p.productId.toString())
      )
      console.log(
        `🆕 Found ${newRozetkaProducts.length} new products on Rozetka`
      )

      // Create new products from Rozetka
      for (const rozetkaProduct of newRozetkaProducts) {
        try {
          console.log(
            `➕ Creating product from Rozetka: ${rozetkaProduct.productId}`
          )
          await createProductFromRozetka(rozetkaProduct)
          result.productsCreatedFromRozetka++
          existingProductIds.add(rozetkaProduct.productId.toString())
        } catch (error: any) {
          console.error(
            `❌ Error creating product ${rozetkaProduct.productId} from Rozetka:`,
            error.message
          )
          result.errors.push(
            `Rozetka product ${rozetkaProduct.productId}: ${error.message}`
          )
        }
      }
    } catch (error: any) {
      console.error('❌ Error fetching Rozetka products:', error.message)
      result.errors.push(`Rozetka fetch error: ${error.message}`)
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
  } catch (error: any) {
    console.error('❌ Critical error in marketplace sync:', error)
    result.success = false
    result.errors.push(`Critical error: ${error.message}`)
    return result
  }
}
