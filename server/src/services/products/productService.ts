// server/src/services/products/productService.ts
import prisma, { Prisma } from '../../config/database'
import {
  updateRozetkaProduct,
  updateMultipleRozetkaProducts,
  type RozetkaUpdateParams,
} from '../marketplaces/rozetkaClient'
import { fetchRozetkaProductsWithTransformation } from '../data-fetchers/fetchRozetkaProducts'
import {
  updatePromProduct,
  updateMultiplePromProducts,
  type PromUpdateParams,
} from '../marketplaces/promClient'
import { fetchPromProductsWithTransformation } from '../data-fetchers/fetchPromProducts'
import {
  createMarketplaceUpdatePromise,
  createMarketplaceSyncStatus,
  normalizeQuantity,
} from '../marketplaces/sync/marketplaceSyncHelpers'
import { ErrorFactory } from '../../middleware/errorHandler'
import { CreateProductInput } from '../../schemas/product.schema'
import type { ProductExternalIds } from '../../types/marketplaces'

type TargetMarketplace = 'prom' | 'rozetka' | 'all'

/**
 * Defines allowed update parameters for a product. Currently quantity and price
 * are supported, but this interface can be extended if other fields need to
 * be updated through the API.
 */
export interface ProductUpdateParams {
  quantity?: number
  price?: number
}
/**
 * Batch update request structure for updating multiple products at once.
 */
export interface BatchProductUpdate {
  productId: string
  updates: ProductUpdateParams
}

export interface SingleUpdateResult {
  success: boolean
  message: string
  productId: string
  updates: ProductUpdateParams
  syncedMarketplaces: string[]
  errors?: Array<{ marketplace: string; error: string }>
}
export interface BatchUpdateResult {
  success: boolean
  message: string
  summary: {
    totalRequested: number
    successfulDatabaseUpdates: number
    failedDatabaseUpdates: number
    marketplacesSynced: string[]
    marketplaceErrors?: Array<{ marketplace: string; error: string }>
  }
  details: {
    successfulProducts: string[]
    failedProducts?: Array<{ productId: string; error: string }>
  }
}

/**
 * Sync result returned when pulling new products from marketplaces. The
 * `success` flag is true only if no errors occurred during the sync; if any
 * errors occur the flag will be set to false.
 */
export interface SyncResult {
  success: boolean
  productsCreatedFromProm: number
  productsCreatedFromRozetka: number
  totalCreated: number
  errors: string[]
}

class ProductService {
  async getProducts(search?: string) {
    // Treat undefined OR "" as "no search"
    const hasSearch = search && search.length > 0

    return prisma.products.findMany({
      where: hasSearch
        ? {
            name: {
              contains: search,
            },
          }
        : undefined,
    })
  }

  async createProduct(productData: CreateProductInput) {
    const product = await prisma.products.create({
      data: productData,
    })
    return product
  }

  /**
   * Update a single product and optionally sync its price/quantity to selected
   * marketplaces. When `targetMarketplace` is omitted or set to `all` the
   * application database is updated immediately and then all marketplaces are
   * updated. When a specific marketplace is targeted the application will
   * validate quantity does not exceed the current stock. On completion the
   * function returns an object containing a status code, a human readable
   * message and information about which marketplaces were updated and any
   * errors.
   */
  async updateSingleProduct({
    productId,
    updates,
    targetMarketplace,
  }: {
    productId: string
    updates: ProductUpdateParams
    targetMarketplace?: TargetMarketplace
  }): Promise<SingleUpdateResult> {
    // First, get the current product to save old price
    const currentProduct = await prisma.products.findUnique({
      where: { productId },
      select: { price: true, stockQuantity: true, externalIds: true },
    })

    if (!currentProduct) {
      throw ErrorFactory.notFound(`Product ${productId} not found`)
    }

    const now = new Date()
    const dbUpdateData: Record<string, unknown> = {
      needsSync: true,
      lastSynced: now,
      dateModified: now,
    }

    // If updating all sides (default), update DB first
    if (!targetMarketplace || targetMarketplace === 'all') {
      if (updates.quantity !== undefined) {
        dbUpdateData.stockQuantity = updates.quantity
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

      await prisma.products.update({
        where: { productId },
        data: dbUpdateData,
      })
    } else if (
      // If updating only one marketplace, ensure quantity <= warehouse
      updates.quantity !== undefined &&
      updates.quantity > currentProduct.stockQuantity
    ) {
      throw ErrorFactory.badRequest(
        'You cannot change quantity bigger than there is in warehouse!'
      )
    }

    // Marketplace sync setup
    const syncResults: string[] = []
    const syncErrors: Array<{ marketplace: string; error: string }> = []
    const syncPromises: Promise<any>[] = []

    // Track which marketplaces were successfully synced
    const syncStatus = createMarketplaceSyncStatus()

    const externalIds = currentProduct.externalIds as ProductExternalIds | null

    // Prom update
    if (
      !targetMarketplace ||
      targetMarketplace === 'all' ||
      targetMarketplace === 'prom'
    ) {
      //console.log('target is Prom')
      if (!externalIds?.prom) {
        // If the user *specifically* asked for prom, treat it as an error
        if (targetMarketplace === 'prom') {
          throw ErrorFactory.badRequest(
            `Product ${productId} is not linked to a Prom product (no external ID).`
          )
        }
        // Otherwise (targetMarketplace='all'), just skip it silently.
      } else {
        const promUpdates: PromUpdateParams = {}
        if (updates.quantity !== undefined)
          promUpdates.quantity = updates.quantity
        if (updates.price !== undefined) promUpdates.price = updates.price

        syncPromises.push(
          createMarketplaceUpdatePromise({
            marketplaceName: 'Prom',
            productId,
            updateFunction: () =>
              updatePromProduct(externalIds.prom!, promUpdates),
            onSuccess: () => (syncStatus.promSynced = true),
            resultsArray: syncResults,
            errorsArray: syncErrors,
          })
        )
      }
    }

    // Rozetka update
    if (
      !targetMarketplace ||
      targetMarketplace === 'all' ||
      targetMarketplace === 'rozetka'
    ) {
      if (!externalIds?.rozetka?.item_id) {
        // Only throw if the user *specifically* asked for Rozetka
        if (targetMarketplace === 'rozetka') {
          throw ErrorFactory.badRequest(
            `Product ${productId} is not linked to a Rozetka product (no external ID).`
          )
        }
        // If target was 'all', we just silently skip it
      } else {
        const rozetkaUpdates: RozetkaUpdateParams = {}
        if (updates.quantity !== undefined)
          rozetkaUpdates.quantity = updates.quantity
        if (updates.price !== undefined) rozetkaUpdates.price = updates.price

        syncPromises.push(
          createMarketplaceUpdatePromise({
            marketplaceName: 'Rozetka',
            productId,
            updateFunction: () =>
              updateRozetkaProduct(externalIds.rozetka!.item_id!, rozetkaUpdates),
            onSuccess: () => (syncStatus.rozetkaSynced = true),
            resultsArray: syncResults,
            errorsArray: syncErrors,
          })
        )
      }
    }

    // Execute parallel updates
    if (syncPromises.length > 0) {
      await Promise.allSettled(syncPromises)
    }

    // Mark sync complete and update marketplace-specific fields
    // 1. Finalize DB update with sync status
    const finalUpdateData: Record<string, unknown> = {}
    const syncTime = new Date()

    // Update Prom-specific fields if Prom was successfully synced
    if (syncStatus.promSynced) {
      finalUpdateData.lastPromSync = syncTime
      if (updates.quantity !== undefined) {
        finalUpdateData.promQuantity = updates.quantity
      }
    }

    // Update Rozetka-specific fields if Rozetka was successfully synced
    if (syncStatus.rozetkaSynced) {
      finalUpdateData.lastRozetkaSync = syncTime
      if (updates.quantity !== undefined) {
        finalUpdateData.rozetkaQuantity = updates.quantity
      }
    }

    if (syncErrors.length === 0) {
      finalUpdateData.needsSync = false
    }

    // Apply final DB updates if needed
    if (Object.keys(finalUpdateData).length > 0) {
      await prisma.products.update({
        where: { productId },
        data: finalUpdateData,
      })
    }

    // 2. Send response
    const success = syncErrors.length === 0
    const message = success
      ? `Product updated${
          targetMarketplace
            ? ' for ' + targetMarketplace
            : ' and synced everywhere'
        } successfully.`
      : `Product update processed${
          targetMarketplace ? ' for ' + targetMarketplace : ''
        }, but with sync errors.`

    return {
      success,
      message,
      productId,
      updates,
      syncedMarketplaces: syncResults,
      errors: success ? undefined : syncErrors,
    }
  }

  async updateBatchProducts({
    products,
    targetMarketplace,
  }: {
    products: BatchProductUpdate[]
    targetMarketplace?: TargetMarketplace
  }): Promise<BatchUpdateResult> {
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

    // Track DB update results
    const successfulUpdates: string[] = []
    const failedUpdates: Array<{ productId: string; error: string }> = []
    dbResults.forEach((result, index) =>
      result.status === 'fulfilled'
        ? successfulUpdates.push(products[index].productId)
        : failedUpdates.push({
            productId: products[index].productId,
            error:
              (result as PromiseRejectedResult).reason?.message ||
              String((result as PromiseRejectedResult).reason),
          })
    )

    //Collect marketplace updates
    const promUpdates: Array<{ productId: string; updates: PromUpdateParams }> =
      []
    const rozetkaUpdates: Array<{
      productId: string
      updates: RozetkaUpdateParams
    }> = []

    //❗❗❗Differ from productController.ts
    for (const productId of successfulUpdates) {
      const original = products.find((p) => p.productId === productId)
      if (!original) continue

      const dbProduct = dbMap.get(productId)
      const externalIds = dbProduct?.externalIds as ProductExternalIds | null

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

    //Sync to marketplaces
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

    //Mark DB as synced
    const syncTime = new Date()
    const markSyncedPromises = successfulUpdates.map((productId) => {
      const data: Record<string, unknown> = { needsSync: false }
      if (syncStatus.promSynced) {
        data.lastPromSync = syncTime
      }
      if (syncStatus.rozetkaSynced) {
        data.lastRozetkaSync = syncTime
      }
      return prisma.products.update({ where: { productId }, data })
    })
    await Promise.allSettled(markSyncedPromises)

    const success = syncErrors.length === 0 && failedUpdates.length === 0
    const message = `Batch update completed${
      targetMarketplace ? ' for ' + targetMarketplace : ''
    }`

    //Respond
    return {
      success,
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
    }
  }

  /**
   * Sync new products from marketplaces to database
   * Only creates products that don't exist in database
   */
  async syncNewProductsFromMarketplaces(): Promise<SyncResult> {
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

    // Build sets of existing external IDs for quick lookup
    const existingPromIds = new Set<string>()
    const existingRozetkaItemIds = new Set<string>()

    existingProducts.forEach((product) => {
      const externalIds = product.externalIds as ProductExternalIds | null

      if (externalIds?.prom) {
        existingPromIds.add(externalIds.prom.toString())
      }

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
          await this.createProductFromProm(promProduct)
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
        const itemId = p.productId?.toString()
        return itemId && !existingRozetkaItemIds.has(itemId)
      })
      console.log(`Found ${newRozetkaProducts.length} new products on Rozetka`)

      // Create new products from Rozetka
      for (const rozetkaProduct of newRozetkaProducts) {
        try {
          const itemId = rozetkaProduct.productId?.toString()
          console.log(`Creating product from Rozetka: ${itemId}`)
          await this.createProductFromRozetka(rozetkaProduct)
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

  private async createProductFromProm(promProduct: any): Promise<void> {
    await prisma.products.create({
      data: {
        ...promProduct,
        stockQuantity: normalizeQuantity(promProduct.stockQuantity),
        promQuantity: normalizeQuantity(promProduct.stockQuantity),
        lastPromSync: new Date(),
      },
    })
  }

  private async createProductFromRozetka(rozetkaProduct: any): Promise<void> {
    await prisma.products.create({
      data: {
        ...rozetkaProduct,
        stockQuantity: normalizeQuantity(rozetkaProduct.stockQuantity),
        rozetkaQuantity: normalizeQuantity(rozetkaProduct.stockQuantity),
        lastRozetkaSync: new Date(),
      },
    })
  }
}

export default new ProductService()
