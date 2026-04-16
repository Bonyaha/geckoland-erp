// server/src/services/products/productService.ts
import prisma, { Prisma } from '../../config/database'
import {
  updateRozetkaProduct,
  updateMultipleRozetkaProducts,
} from '../marketplaces/rozetkaClient'
import { fetchRozetkaProductsWithTransformation } from '../data-fetchers/fetchRozetkaProducts'
import {
  updatePromProduct,
  updateMultiplePromProducts,
} from '../marketplaces/promClient'
import { fetchPromProductsWithTransformation } from '../data-fetchers/fetchPromProducts'
import {
  createMarketplaceUpdatePromise,
  createMarketplaceSyncStatus,
} from '../marketplaces/sync/marketplaceSyncHelpers'
import { settingsService } from '../settings/settingsService'
import { normalizeQuantity } from '../../utils/helpers/normalizeQuantity'
import { ErrorFactory } from '../../middleware/errorHandler'
import type {
  ProductExternalIds,
  TargetMarketplace,
  MarketplaceUpdateResult,
  BaseProductUpdateParams,
  MarketplaceSyncStatus,
  PromBatchUpdate,
  RozetkaBatchUpdate,
  ProductExternalIdsJson,
} from '../../types/marketplaces'
import {
  ProductUpdateParams,
  SingleProductUpdateInput,
  SingleProductUpdateResult,
  BatchProductUpdateInput,
  BatchProductUpdateResult,
  ProductSyncResult,
  PromProductData,
  RozetkaProductData,
  BatchProductUpdateItem,
  ProductCreateInput,
} from '../../types/products'

// ---------------------------------------------------------------------------
// Internal helper types
// ---------------------------------------------------------------------------

type BatchEnrichedProduct = {
  original: BatchProductUpdateItem
  dbProduct:
    | { productId: string; stockQuantity: number; externalIds: unknown }
    | undefined
  externalIds: ProductExternalIds | null
  hasMarketplaceUpdates: boolean
}

/**
 * Minimal description of a product needed to push updates to marketplace APIs.
 * Intentionally keeps only what `pushProductsToMarketplaces` needs so callers
 * don't have to build the full BatchEnrichedProduct shape.
 */
type MarketplacePushItem = {
  productId: string // internal DB id — used only for the DB sync-status write
  externalIds: ProductExternalIds | null
  updates: ProductUpdateParams
}

/**
 * Return value of `pushProductsToMarketplaces`.
 * Mirrors the fields that `updateBatchProducts` previously computed inline.
 */
type MarketplacePushResult = {
  syncResults: string[]
  syncErrors: MarketplaceUpdateResult[]
  syncStatus: MarketplaceSyncStatus
}

/**
 * Service class for product-related operations.
 * Handles CRUD operations and marketplace synchronization.
 */
class ProductService {
  /**
   * Retrieves products from the database with optional search filtering.
   *
   * @param search - Optional search term to filter products by name
   * @returns Array of products matching the search criteria
   *
   * @example
   * // Get all products
   * const allProducts = await productService.getProducts()
   *
   * // Search for specific products
   * const results = await productService.getProducts('laptop')
   */
  async getProducts(params?: {
    search?: string
    page?: number
    limit?: number
    stockFilter?: 'all' | 'inStock' | 'outOfStock'
  }) {
    const { search, page = 1, limit = 20, stockFilter = 'all' } = params || {}

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}

    // Search filter
    if (search && search.length > 0) {
      // Clean the search term (remove extra spaces, convert to uppercase for ID matching)
      const cleanSearch = search.trim()

      where.OR = [
        // Search by product name (case-insensitive)
        {
          name: {
            contains: cleanSearch,
            mode: 'insensitive',
          },
        },
        // Search by exact productId match
        {
          productId: {
            equals: cleanSearch,
          },
        },
        // Search by productId contains (case-insensitive)
        {
          productId: {
            contains: cleanSearch,
            mode: 'insensitive',
          },
        },
        // Search by SKU
        {
          sku: {
            contains: cleanSearch,
            mode: 'insensitive',
          },
        },
      ]
    }

    // Stock filter
    if (stockFilter === 'inStock') {
      where.stockQuantity = { gt: 0 }
    } else if (stockFilter === 'outOfStock') {
      where.stockQuantity = { lte: 0 }
    }
    // 'all' means no additional filter

    // Fetch products with pagination
    const [products, total] = await Promise.all([
      prisma.products.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dateModified: 'desc' },
      }),
      prisma.products.count({ where }),
    ])

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Calculates inventory statistics for the entire database.
   */
  async getProductStats() {
    // Run queries in parallel for performance
    const [totalGoods, inStockCount, inventoryData] = await Promise.all([
      // 1. Total count of products
      prisma.products.count(),
      // 2. Count of products with stock > 0
      prisma.products.count({ where: { stockQuantity: { gt: 0 } } }),
      // 3. Get only price and quantity for aggregation
      // We fetch this instead of using aggregate for "value" because
      // (price * quantity) sum isn't directly supported in simple Prisma aggregate
      prisma.products.findMany({
        select: {
          price: true,
          stockQuantity: true,
        },
      }),
    ])

    // Calculate sums in memory (very fast for this data size)
    let totalUnits = 0
    let totalValue = 0

    inventoryData.forEach((p) => {
      const qty = p.stockQuantity || 0
      // Convert Prisma Decimal to number
      const price = p.price ? Number(p.price) : 0

      totalUnits += qty
      totalValue += price * qty
    })

    return {
      totalGoods,
      inStockCount,
      totalUnits,
      totalValue,
      // Potential profit logic from your frontend (30%)
      potentialProfit: totalValue * 0.3,
    }
  }

  /*
   * Gets the synchronization status of a specific product, including whether it needs to be synced to marketplaces.
   * @param productId - The ID of the product to check
   * @returns An object containing the sync status for the product
   */
  async getProductSyncStatus(productId: string) {
    const product = await prisma.products.findUnique({
      where: { productId },
      select: {
        needsSync: true,
        needsPromSync: true,
        needsRozetkaSync: true,
      },
    })

    if (!product) {
      throw ErrorFactory.notFound(`Product ${productId} not found`)
    }

    return product
  }

  /**
   * Creates a new product in the database.
   *
   * @param productData - Product data matching the schema validation
   * @returns The created product record
   *
   * @example
   * const product = await productService.createProduct({
   *   productId: 'prod_123',
   *   name: 'Sample Product',
   *   price: 299.99,
   *   stockQuantity: 10,
   *   available: true,
   *   externalIds: { prom: '123' },
   *   images: []
   * })
   */
  async createProduct(productData: ProductCreateInput) {
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
  }: SingleProductUpdateInput): Promise<SingleProductUpdateResult> {
    // First, get the current product to save old price
    const [currentProduct, rozetkaActive] = await Promise.all([
      prisma.products.findUnique({
        where: { productId },
        select: { price: true, stockQuantity: true, externalIds: true },
      }),
      settingsService.isRozetkaStoreActive(),
    ])

    if (!currentProduct) {
      throw ErrorFactory.notFound(`Product ${productId} not found`)
    }

    const now = new Date()
    const dbUpdateData: Record<string, unknown> = {
      lastSynced: now,
      dateModified: now,
    }

    if (updates.costPrice !== undefined) {
      dbUpdateData.costPrice = updates.costPrice
    }

    // If updating all sides (default), update DB first
    if (!targetMarketplace || targetMarketplace === 'all') {
      if (updates.quantity !== undefined) {
        dbUpdateData.stockQuantity = updates.quantity
        dbUpdateData.available = updates.quantity > 0
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
    } else if (
      // If updating only one marketplace, ensure quantity <= warehouse
      updates.quantity !== undefined &&
      updates.quantity > currentProduct.stockQuantity
    ) {
      throw ErrorFactory.badRequest(
        'You cannot change quantity bigger than there is in warehouse!',
      )
    }

    const externalIds = currentProduct.externalIds as ProductExternalIds | null

    // Only sync to marketplaces if quantity or price changed (not costPrice)
    const needsMarketplaceSync =
      updates.quantity !== undefined || updates.price !== undefined

    if (needsMarketplaceSync) {
      // Check if we need to sync to Prom
      const needsPromSync =
        (!targetMarketplace ||
          targetMarketplace === 'all' ||
          targetMarketplace === 'prom') &&
        externalIds?.prom

      // Check if we need to sync to Rozetka
      const needsRozetkaSync =
        (!targetMarketplace ||
          targetMarketplace === 'all' ||
          targetMarketplace === 'rozetka') &&
        externalIds?.rozetka?.item_id &&
        rozetkaActive

      if (needsPromSync || needsRozetkaSync) {
        dbUpdateData.needsSync = true
        if (needsPromSync) dbUpdateData.needsPromSync = true
        if (needsRozetkaSync) dbUpdateData.needsRozetkaSync = true
      }
      // For Rozetka when store is inactive, track quantity but mark as needing sync
      if (
        !rozetkaActive &&
        externalIds?.rozetka?.item_id &&
        (!targetMarketplace ||
          targetMarketplace === 'all' ||
          targetMarketplace === 'rozetka') &&
        updates.quantity !== undefined
      ) {
        dbUpdateData.rozetkaQuantity = updates.quantity
        dbUpdateData.needsRozetkaSync = true
        dbUpdateData.needsSync = true
      }
    }

    // Perform ONE single database update
    await prisma.products.update({
      where: { productId },
      data: dbUpdateData,
    })

    // Fire-and-forget marketplace sync in background
    // This runs AFTER the response is sent to the user
    if (needsMarketplaceSync) {
      this.syncToMarketplacesInBackground(
        productId,
        updates,
        externalIds,
        targetMarketplace,
        rozetkaActive,
      ).catch((err) => {
        console.error(`❌ Background sync failed for ${productId}:`, err)
        // Optionally: log to error tracking service (Sentry, etc.)
      })
    }
    // Return immediately with optimistic response
    // User doesn't wait for marketplace APIs
    const message =
      needsMarketplaceSync &&
      (updates.quantity !== undefined || updates.price !== undefined)
        ? 'Product updated successfully (syncing to marketplaces in background)'
        : updates.costPrice !== undefined && !needsMarketplaceSync
          ? 'Cost price updated successfully'
          : 'Product updated successfully'

    return {
      success: true,
      message,
      productId,
      updates,
      syncedMarketplaces: [], // Empty initially - sync happens in background
    }
  }

  // Background sync method (runs AFTER response is sent)
  private async syncToMarketplacesInBackground(
    productId: string,
    updates: ProductUpdateParams,
    externalIds: ProductExternalIds | null,
    targetMarketplace?: TargetMarketplace,
    rozetkaActive: boolean = true,
  ): Promise<void> {
    console.log(`🔄 Starting background marketplace sync for ${productId}`)

    // Marketplace sync setup
    const syncResults: string[] = []
    const syncErrors: MarketplaceUpdateResult[] = []
    const syncPromises: Promise<void>[] = []

    // Track which marketplaces were successfully synced
    const syncStatus: MarketplaceSyncStatus = createMarketplaceSyncStatus()

    // Prepare Prom updates
    if (
      (!targetMarketplace ||
        targetMarketplace === 'all' ||
        targetMarketplace === 'prom') &&
      externalIds?.prom
    ) {
      const promUpdates: ProductUpdateParams = {}
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
        }),
      )
    }

    // Prepare Rozetka updates
    if (
      (!targetMarketplace ||
        targetMarketplace === 'all' ||
        targetMarketplace === 'rozetka') &&
      externalIds?.rozetka?.item_id &&
      rozetkaActive
    ) {
      const rozetkaUpdates: ProductUpdateParams = {}
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
        }),
      )
    }

    // Execute marketplace API calls
    if (syncPromises.length > 0) {
      await Promise.allSettled(syncPromises)
    }

    // Update database with final sync status
    const syncTime = new Date()
    const finalUpdateData: Record<string, unknown> = {}

    // Update Prom-specific fields if Prom was successfully synced
    if (syncStatus.promSynced) {
      finalUpdateData.lastPromSync = syncTime
      if (updates.quantity !== undefined) {
        finalUpdateData.promQuantity = updates.quantity
      }
      finalUpdateData.needsPromSync = false
    }

    // Update Rozetka-specific fields if Rozetka was successfully synced
    if (syncStatus.rozetkaSynced) {
      finalUpdateData.lastRozetkaSync = syncTime
      if (updates.quantity !== undefined) {
        finalUpdateData.rozetkaQuantity = updates.quantity
      }
      finalUpdateData.needsRozetkaSync = false
    } else if (
      !rozetkaActive &&
      externalIds?.rozetka?.item_id &&
      (!targetMarketplace ||
        targetMarketplace === 'all' ||
        targetMarketplace === 'rozetka') &&
      updates.quantity !== undefined
    ) {
      // Store is inactive - keep quantity in sync but mark as needing sync
      finalUpdateData.rozetkaQuantity = updates.quantity
      finalUpdateData.needsRozetkaSync = true
    }

    // Clear needsSync only if both marketplace flags are false
    const willNeedPromSync = finalUpdateData.needsPromSync ?? false
    const willNeedRozetkaSync = finalUpdateData.needsRozetkaSync ?? false
    finalUpdateData.needsSync = willNeedPromSync || willNeedRozetkaSync

    // Apply final DB updates with sync status
    if (Object.keys(finalUpdateData).length > 0) {
      await prisma.products.update({
        where: { productId },
        data: finalUpdateData,
      })
    }

    // Log results
    if (syncErrors.length === 0) {
      console.log(`✅ Background sync completed successfully for ${productId}`)
      console.log(`   Synced to: ${syncResults.join(', ')}`)
    } else {
      console.error(`⚠️ Background sync completed with errors for ${productId}`)
      syncErrors.forEach((err) => {
        console.error(`   ${err.marketplace}: ${err.error}`)
      })
    }
  }

  /**
   * Updates multiple products in a single batch operation (DB + marketplace sync).
   *
   * This method owns the DB-write side of the operation.  The marketplace-push
   * side is fully delegated to `pushProductsToMarketplaces`, which can also be
   * called independently when you only need to push without touching the DB
   * (e.g. the "sync/push" endpoint that reconciles DB→marketplace quantities).
   */
  async updateBatchProducts({
    products,
    targetMarketplace,
  }: BatchProductUpdateInput): Promise<BatchProductUpdateResult> {
    //console.log(`Starting batch update for ${products.length} products`)

    // Fetch all products first for warehouse validation
    const productIds = products.map((p: BatchProductUpdateItem) => p.productId)
    const dbProducts = await prisma.products.findMany({
      where: { productId: { in: productIds } },
      select: {
        productId: true,
        stockQuantity: true,
        externalIds: true,
      },
    })

    const dbMap = new Map(dbProducts.map((p) => [p.productId, p]))

    // This single flag drives both the sync-skip and the DB mark logic below.
    const rozetkaActive = await settingsService.isRozetkaStoreActive()

    // Warehouse validation if only one marketplace is targeted
    if (targetMarketplace && targetMarketplace !== 'all') {
      for (const item of products) {
        const { productId, updates }: BatchProductUpdateItem = item

        if (updates.quantity !== undefined) {
          const dbProduct = dbMap.get(productId)
          if (!dbProduct) continue
          if (updates.quantity > dbProduct.stockQuantity) {
            throw ErrorFactory.badRequest(
              `Product ${productId}: You cannot change quantity bigger than there is in warehouse!`,
            )
          }
        }
      }
    }

    // Check if this is ONLY a cost price update (no quantity or price changes)
    const isCostPriceOnlyUpdate = products.every(
      (item: BatchProductUpdateItem) =>
        item.updates.costPrice !== undefined &&
        item.updates.quantity === undefined &&
        item.updates.price === undefined,
    )

    // Write primary product columns (stockQuantity, price, available) only when
    // targeting all marketplaces — because in that case `updates.quantity` is
    // the new warehouse truth, not just a number to push outward.
    //
    // Sync-metadata columns (lastPromSync, promQuantity, needsRozetkaSync …)
    // are always written by pushProductsToMarketplaces after the API calls,
    // regardless of which path we took here.
    let dbResults: PromiseSettledResult<any>[] = []

    if (
      !targetMarketplace ||
      targetMarketplace === 'all' ||
      isCostPriceOnlyUpdate
    ) {
      const dbUpdatePromises = products.map((item: BatchProductUpdateItem) => {
        const updateData: Record<string, unknown> = {
          lastSynced: new Date(),
          dateModified: new Date(),
        }

        const hasMarketplaceFields =
          item.updates.quantity !== undefined ||
          item.updates.price !== undefined

        if (hasMarketplaceFields && !isCostPriceOnlyUpdate) {
          const externalIds = dbMap.get(item.productId)
            ?.externalIds as ProductExternalIds | null

          const wouldSyncProm =
            (!targetMarketplace ||
              targetMarketplace === 'all' ||
              targetMarketplace === 'prom') &&
            !!externalIds?.prom

          const wouldSyncRozetka =
            (!targetMarketplace ||
              targetMarketplace === 'all' ||
              targetMarketplace === 'rozetka') &&
            !!externalIds?.rozetka?.item_id &&
            rozetkaActive

          if (wouldSyncProm || wouldSyncRozetka) {
            updateData.needsSync = true
            if (wouldSyncProm) updateData.needsPromSync = true
            if (wouldSyncRozetka) updateData.needsRozetkaSync = true
          }

          // Track rozetkaQuantity locally even when the store is paused,
          // so the value is accurate when the store eventually resumes.
          if (
            !rozetkaActive &&
            externalIds?.rozetka?.item_id &&
            (!targetMarketplace ||
              targetMarketplace === 'all' ||
              targetMarketplace === 'rozetka') &&
            item.updates.quantity !== undefined
          ) {
            updateData.rozetkaQuantity = item.updates.quantity
            updateData.needsRozetkaSync = true
            updateData.needsSync = true
          }
        }

        if (item.updates.quantity !== undefined) {
          updateData.stockQuantity = item.updates.quantity
          updateData.available = item.updates.quantity > 0
        }

        if (item.updates.price !== undefined) {
          updateData.price = item.updates.price
        }

        if (item.updates.costPrice !== undefined) {
          updateData.costPrice = item.updates.costPrice
        }

        return prisma.products.update({
          where: { productId: item.productId },
          data: updateData,
        })
      })
      dbResults = await Promise.allSettled(dbUpdatePromises)
    } else {
      // Skip DB updates for marketplace-only operations
      // fabricate fulfilled results so the tracking
      // logic below stays uniform.
      dbResults = products.map((item: BatchProductUpdateItem) => ({
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
          }),
    )    

    // If this is ONLY a cost price update, skip marketplace sync entirely
    if (isCostPriceOnlyUpdate) {
      //console.log('Cost price only update - skipping marketplace sync')

      const message = 'Batch cost price update completed (internal only)'

      return {
        success: failedUpdates.length === 0,
        message,
        summary: {
          totalRequested: products.length,
          successfulDatabaseUpdates: successfulUpdates.length,
          failedDatabaseUpdates: failedUpdates.length,
          marketplacesSynced: [],
          marketplaceErrors: undefined,
        },
        details: {
          successfulProducts: successfulUpdates,
          failedProducts: failedUpdates.length > 0 ? failedUpdates : undefined,
        },
      }
    }

    // ── Build push items for successfully-written products ─────────────────
    const pushItems: MarketplacePushItem[] = []

    for (const productId of successfulUpdates) {
      const original = products.find(
        (p: BatchProductUpdateItem) => p.productId === productId,
      )
      if (!original) continue

      const hasMarketplaceUpdates =
        original.updates.quantity !== undefined ||
        original.updates.price !== undefined
      if (!hasMarketplaceUpdates) continue

      const externalIds = dbMap.get(productId)
        ?.externalIds as ProductExternalIds | null

      pushItems.push({ productId, externalIds, updates: original.updates })
    }

        // CHANGE: Fire-and-forget background marketplace sync — return response
    // to the user immediately without waiting for Prom / Rozetka APIs.
    if (pushItems.length > 0) {
      this.syncBatchToMarketplacesInBackground( // NEW method call
        pushItems,
        targetMarketplace ?? 'all',
        rozetkaActive,
      ).catch((err) => {
        console.error(`❌ Batch background sync failed:`, err)
      })
    }

    const success = failedUpdates.length === 0
    const message = `Batch update completed${
      targetMarketplace ? ' for ' + targetMarketplace : ''
    }`

    return {
      success,
      message,
      summary: {
        totalRequested: products.length,
        successfulDatabaseUpdates: successfulUpdates.length,
        failedDatabaseUpdates: failedUpdates.length,
        marketplacesSynced: [], //empty – sync is in background, not yet done
        marketplaceErrors:
          failedUpdates.length > 0
            ? failedUpdates.map((f) => ({
                marketplace: 'database',
                success: false,
                error: f.error,
              }))
            : undefined,
      },
      details: {
        successfulProducts: successfulUpdates,
        failedProducts: failedUpdates.length > 0 ? failedUpdates : undefined,
      },
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // NEW private helper — runs AFTER the response is already sent to the user.
  // Mirrors syncToMarketplacesInBackground() but operates on a batch of products.
  // ────────────────────────────────────────────────────────────────────────────
 
  /**
   * Calls Prom and Rozetka APIs for a batch of products in the background,
   * then writes the resulting sync-status metadata (lastPromSync, promQuantity,
   * needsRozetkaSync, etc.) back to the DB and clears the needsSync flags.
   *
   * This method is intentionally fire-and-forget — the caller does NOT await it.
   * Errors are logged but never re-thrown so they cannot affect the already-sent
   * HTTP response.
   */
  private async syncBatchToMarketplacesInBackground(
    items: MarketplacePushItem[],
    target: TargetMarketplace,
    rozetkaActive: boolean,
  ): Promise<void> {
    console.log(
      `🔄 Starting background batch marketplace sync for ${items.length} products`,
    )
 
    try {
      const { syncResults, syncErrors, syncStatus } =
        await this.pushProductsToMarketplaces(items, target, rozetkaActive)
 
      // pushProductsToMarketplaces already handles the per-product DB
      // sync-status writes (lastPromSync, promQuantity, needsRozetkaSync, needsSync).
      // Nothing extra to do here — just log the outcome.
 
      if (syncErrors.length === 0) {
        console.log(
          `✅ Background batch sync completed successfully for ${items.length} products`,
        )
        console.log(`   Synced to: ${syncResults.join(', ')}`)
      } else {
        console.error(
          `⚠️ Background batch sync completed with ${syncErrors.length} error(s)`,
        )
        syncErrors.forEach((err) => {
          console.error(`   ${err.marketplace}: ${err.error}`)
        })
      }
    } catch (err) {
      console.error(`❌ Background batch sync threw unexpectedly:`, err)
      // Don't re-throw — user already got their response
    }
  }

  /**
   * Pushes current DB quantities/prices for the given products to one or all
   * marketplaces, **without touching the main product columns in the DB**.
   *
   * This is the entry-point for "DB → marketplace reconciliation" flows:
   * - The `POST /api/products/sync/push` endpoint calls this directly.
   * - `updateBatchProducts` also calls this after its own DB writes.
   *
   * After successful API calls the method writes only the marketplace-specific
   * sync metadata (`lastPromSync`, `promQuantity`, `needsRozetkaSync`, …) so
   * the DB stays accurate for future reconciliation runs.
   *
   * @param items   Products to push, each carrying their externalIds and the
   *                update payload (quantity / price) to send to the APIs.
   * @param target  Which marketplace(s) to push to.
   * @param rozetkaActive  Pre-fetched Rozetka store-active flag.  The caller
   *                       owns the `settingsService` call so we don't repeat it.
   */
  async pushProductsToMarketplaces(
    items: MarketplacePushItem[],
    target: TargetMarketplace,
    rozetkaActive: boolean,
  ): Promise<MarketplacePushResult> {
    const promUpdates: PromBatchUpdate[] = []
    const rozetkaUpdates: RozetkaBatchUpdate[] = []

    // Collect per-marketplace payloads
    for (const { externalIds, updates } of items) {
      if ((target === 'all' || target === 'prom') && externalIds?.prom) {
        const params: ProductUpdateParams = {}
        if (updates.quantity !== undefined) params.quantity = updates.quantity
        if (updates.price !== undefined) params.price = updates.price
        promUpdates.push({ productId: externalIds.prom, updates: params })
      }

      if (
        (target === 'all' || target === 'rozetka') &&
        externalIds?.rozetka?.item_id
      ) {
        if (!rozetkaActive) {
          console.log(
            `Skipping Rozetka sync for product with item_id=${externalIds.rozetka.item_id} - store is paused`,
          )
        } else {
          const params: ProductUpdateParams = {}
          if (updates.quantity !== undefined) params.quantity = updates.quantity
          if (updates.price !== undefined) params.price = updates.price
          rozetkaUpdates.push({
            productId: externalIds.rozetka.item_id,
            updates: params,
          })
        }
      }
    }

    // Execute API calls in parallel
    const syncResults: string[] = []
    const syncErrors: MarketplaceUpdateResult[] = []
    const syncStatus: MarketplaceSyncStatus = createMarketplaceSyncStatus()
    const syncPromises: Promise<void>[] = []

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
        }),
      )
    }

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
        }),
      )
    }

    await Promise.allSettled(syncPromises)

    // Write sync-status metadata back to the DB
    const syncTime = new Date()
    const metaUpdatePromises = items.map(
      ({ productId, externalIds, updates }) => {
        const data: Record<string, unknown> = {}

        if (syncStatus.promSynced) {
          data.lastPromSync = syncTime
          if (updates.quantity !== undefined)
            data.promQuantity = updates.quantity
 data.needsPromSync = false
        }

        if (syncStatus.rozetkaSynced) {
          data.lastRozetkaSync = syncTime
          if (updates.quantity !== undefined)
            data.rozetkaQuantity = updates.quantity
          data.needsRozetkaSync = false
        } else if (!rozetkaActive && externalIds?.rozetka?.item_id) {
          // Store is paused — mirror quantity internally so it's accurate on resume
          if (updates.quantity !== undefined)
            data.rozetkaQuantity = updates.quantity
          data.needsRozetkaSync = true
        }

        data.needsSync =
          Boolean(data.needsPromSync) || Boolean(data.needsRozetkaSync)

        return prisma.products.update({ where: { productId }, data })
      },
    )

    await Promise.allSettled(metaUpdatePromises)

    return { syncResults, syncErrors, syncStatus }
  }

  /**
   * Syncs new products from marketplaces to the database.
   * Only creates products that don't already exist.
   *
   * @returns Sync result with counts and error messages
   *
   * @remarks
   * - Compares external IDs to avoid duplicates
   * - Fetches from both Prom and Rozetka simultaneously
   * - Continues processing even if some products fail
   * - Returns success=false if any errors occurred
   *
   * @example
   * const result = await productService.syncNewProductsFromMarketplaces()
   *
   * if (result.success) {
   *   console.log(`Created ${result.totalCreated} new products`)
   * } else {
   *   console.error(`Sync completed with ${result.errors.length} errors`)
   * }
   */
  /**
   * OPTIMIZED VERSION - syncNewProductsFromMarketplaces
   *
   * Key Performance Improvements:
   * 1. Fetch only products with matching IDs/SKUs instead of ALL products
   * 2. Use createMany() for batch operations (much faster)
   * 3. Early exits when no work needed
   * 4. Parallel processing where possible
   * 5. Reduced Set/Map operations
   */

  async syncNewProductsFromMarketplaces(): Promise<ProductSyncResult> {
    const result: ProductSyncResult = {
      success: true,
      productsCreatedFromProm: 0,
      productsCreatedFromRozetka: 0,
      totalCreated: 0,
      errors: [],
    }

    console.log('🔄 Starting sync for new products from marketplaces...')

    // OPTIMIZATION 1: Fetch marketplace data in parallel with minimal DB query
    // Instead of fetching ALL product fields, only get what we need for comparison
    const [existingLookup, promProducts, rozetkaProducts] = await Promise.all([
      // Only fetch the fields needed for duplicate detection
      prisma.products.findMany({
        select: {
          sku: true,
          externalIds: true,
        },
      }),
      fetchPromProductsWithTransformation().catch((error) => {
        console.error('Error fetching Prom products:', error.message)
        result.errors.push(`Prom fetch failed: ${error.message}`)
        return [] as PromProductData[]
      }),
      fetchRozetkaProductsWithTransformation().catch((error) => {
        console.error('Error fetching Rozetka products:', error.message)
        result.errors.push(`Rozetka fetch failed: ${error.message}`)
        return [] as RozetkaProductData[]
      }),
    ])

    // OPTIMIZATION 2: Early return if no new products to process
    if (promProducts.length === 0 && rozetkaProducts.length === 0) {
      console.log('ℹ️ No products fetched from marketplaces')
      return result
    }

    console.log(
      `✅ Fetched ${promProducts.length} Prom, ${rozetkaProducts.length} Rozetka products`,
    )

    // OPTIMIZATION 3: Build efficient lookup structures in a single pass
    const existingPromIds = new Set<string>()
    const existingRozetkaIds = new Set<string>()
    const existingSKUs = new Set<string>()

    for (const product of existingLookup) {
      const externalIds = product.externalIds as ProductExternalIds | null

      if (externalIds?.prom) {
        existingPromIds.add(externalIds.prom.toString())
      }

      if (externalIds?.rozetka?.rz_item_id) {
        existingRozetkaIds.add(externalIds.rozetka.rz_item_id.toString())
      }

      if (product.sku) {
        existingSKUs.add(product.sku)
      }
    }

    console.log(
      `📦 Existing: ${existingPromIds.size} Prom, ${existingRozetkaIds.size} Rozetka, ${existingSKUs.size} SKUs`,
    )

    // OPTIMIZATION 4: Build Rozetka lookup only once and filter simultaneously
    const rozetkaBySKU = new Map<string, RozetkaProductData>()
    const newRozetkaProducts: RozetkaProductData[] = []

    for (const p of rozetkaProducts) {
      const itemId = p.productId?.toString()
      const sku = p.sku

      // Add to SKU lookup for Prom matching
      if (sku && !existingSKUs.has(sku)) {
        rozetkaBySKU.set(sku, p)
      }

      // Filter new Rozetka products in the same loop
      if (
        itemId &&
        !existingRozetkaIds.has(itemId) &&
        !(sku && existingSKUs.has(sku))
      ) {
        newRozetkaProducts.push(p)
      }
    }

    // OPTIMIZATION 5: Filter and prepare Prom products with matching in one pass
    const promCreateOperations: Prisma.ProductsCreateInput[] = []
    const matchedRozetkaSKUs = new Set<string>()

    for (const promProduct of promProducts) {
      const promId = promProduct.productId.toString()
      const sku = promProduct.sku

      // Skip if already exists
      if (existingPromIds.has(promId) || (sku && existingSKUs.has(sku))) {
        continue
      }

      // Check for Rozetka match
      const matchingRozetkaProduct = sku ? rozetkaBySKU.get(sku) : null

      if (matchingRozetkaProduct) {
        // Combined Prom + Rozetka product
        const combinedExternalIds: ProductExternalIdsJson = {
          prom: promId,
          rozetka: {
            rz_item_id: matchingRozetkaProduct.productId,
            item_id: matchingRozetkaProduct.externalIds.rozetka,
          },
        }

        promCreateOperations.push({
          ...promProduct,
          externalIds: combinedExternalIds,
          stockQuantity: normalizeQuantity(promProduct.stockQuantity),
          promQuantity: normalizeQuantity(promProduct.stockQuantity),
          rozetkaQuantity: normalizeQuantity(
            matchingRozetkaProduct.stockQuantity,
          ),
          lastPromSync: new Date(),
          lastRozetkaSync: new Date(),
        })

        if (sku) matchedRozetkaSKUs.add(sku)
      } else {
        // Prom-only product
        promCreateOperations.push({
          ...promProduct,
          stockQuantity: normalizeQuantity(promProduct.stockQuantity),
          promQuantity: normalizeQuantity(promProduct.stockQuantity),
          lastPromSync: new Date(),
        })
      }
    }

    console.log(`📊 New products: ${promCreateOperations.length} Prom-sourced`)
    console.log('SKUs:', promCreateOperations.map((p) => p.sku).join(', '))

    // OPTIMIZATION 6: Execute batch creates in parallel (not sequentially)
    const createPromises: Promise<any>[] = []

    // Prom products batch
    if (promCreateOperations.length > 0) {
      createPromises.push(
        prisma
          .$transaction(
            promCreateOperations.map((data) =>
              prisma.products.create({ data }),
            ),
          )
          .then(() => {
            result.productsCreatedFromProm = promCreateOperations.length
            console.log(
              `✅ Created ${promCreateOperations.length} Prom-sourced products`,
            )
          })
          .catch((error: any) => {
            console.error('Error in Prom batch creation:', error)
            result.errors.push(`Prom batch creation failed: ${error.message}`)
            result.success = false
          }),
      )
    }

    // OPTIMIZATION 7: Filter Rozetka-only products more efficiently
    const rozetkaOnlyProducts = newRozetkaProducts.filter(
      (p) => !p.sku || !matchedRozetkaSKUs.has(p.sku),
    )

    console.log(`📊 New products: ${rozetkaOnlyProducts.length} Rozetka-only`)

    // Rozetka-only products batch
    if (rozetkaOnlyProducts.length > 0) {
      const rozetkaCreateOperations: Prisma.ProductsCreateInput[] =
        rozetkaOnlyProducts.map((rozetkaProduct) => ({
          ...rozetkaProduct,
          stockQuantity: normalizeQuantity(rozetkaProduct.stockQuantity),
          rozetkaQuantity: normalizeQuantity(rozetkaProduct.stockQuantity),
          lastRozetkaSync: new Date(),
        }))

      createPromises.push(
        prisma
          .$transaction(
            rozetkaCreateOperations.map((data) =>
              prisma.products.create({ data }),
            ),
          )
          .then(() => {
            result.productsCreatedFromRozetka = rozetkaCreateOperations.length
            console.log(
              `✅ Created ${rozetkaCreateOperations.length} Rozetka-only products`,
            )
          })
          .catch((error: any) => {
            console.error('Error in Rozetka batch creation:', error)
            result.errors.push(
              `Rozetka batch creation failed: ${error.message}`,
            )
            result.success = false
          }),
      )
    }

    // OPTIMIZATION 8: Wait for both batch operations in parallel
    if (createPromises.length > 0) {
      await Promise.all(createPromises)
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

  /**
   * Internal helper: Creates a product from Prom data.
   */
  private async createProductFromProm(
    promProduct: PromProductData,
  ): Promise<void> {
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
   * Internal helper: Creates a product from Rozetka data.
   */
  private async createProductFromRozetka(
    rozetkaProduct: RozetkaProductData,
  ): Promise<void> {
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
