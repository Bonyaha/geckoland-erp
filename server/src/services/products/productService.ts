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
    const syncErrors: MarketplaceUpdateResult[] = []
    const syncPromises: Promise<any>[] = []

    // Track which marketplaces were successfully synced
    const syncStatus: MarketplaceSyncStatus = createMarketplaceSyncStatus()

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
        const rozetkaUpdates: ProductUpdateParams = {}
        if (updates.quantity !== undefined)
          rozetkaUpdates.quantity = updates.quantity
        if (updates.price !== undefined) rozetkaUpdates.price = updates.price

        syncPromises.push(
          createMarketplaceUpdatePromise({
            marketplaceName: 'Rozetka',
            productId,
            updateFunction: () =>
              updateRozetkaProduct(
                externalIds.rozetka!.item_id!,
                rozetkaUpdates
              ),
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

  /**
   * Updates multiple products in a single batch operation.
   * More efficient than individual updates when changing many products.
   *
   * @param params - Batch update parameters including products array and target marketplace
   * @returns Result object with summary statistics and detailed results
   * @throws {Error} If validation fails
   *
   * @remarks
   * - Validates all products before starting updates
   * - If targeting specific marketplace, validates quantities don't exceed stock
   * - Uses Prisma transactions for database updates
   * - Uses marketplace batch APIs when available for efficiency
   *
   * @example
   * const result = await productService.updateBatchProducts({
   *   products: [
   *     { productId: 'prod_1', updates: { quantity: 10 } },
   *     { productId: 'prod_2', updates: { price: 199.99 } }
   *   ],
   *   targetMarketplace: 'all'
   * })
   *
   * console.log(`Updated ${result.summary.successfulDatabaseUpdates} products`)
   */
  async updateBatchProducts({
    products,
    targetMarketplace,
  }: BatchProductUpdateInput): Promise<BatchProductUpdateResult> {
    console.log(`Starting batch update for ${products.length} products`)

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

    // Warehouse validation if only one marketplace is targeted
    if (targetMarketplace && targetMarketplace !== 'all') {
      for (const item of products) {
        const { productId, updates }: BatchProductUpdateItem = item

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
      const dbUpdatePromises = products.map((item: BatchProductUpdateItem) =>
        prisma.products.update({
          where: { productId: item.productId },
          data: {
            needsSync: true,
            lastSynced: new Date(),
            ...(item.updates.quantity !== undefined && {
              stockQuantity: item.updates.quantity,
              available: item.updates.quantity > 0,
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
          })
    )

    //Collect marketplace updates
    const promUpdates: PromBatchUpdate[] = []
    const rozetkaUpdates: RozetkaBatchUpdate[] = []

    //❗❗❗Differ from productController.ts
    for (const productId of successfulUpdates) {
      const original = products.find(
        (p: BatchProductUpdateItem) => p.productId === productId
      )
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
        const promParams: ProductUpdateParams = {}
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
        const rozetkaParams: ProductUpdateParams = {}
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
    const syncErrors: MarketplaceUpdateResult[] = []
    const syncStatus: MarketplaceSyncStatus = createMarketplaceSyncStatus()
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

  // Optimized version of syncNewProductsFromMarketplaces
  // Key improvements:
  // 1. Reduced database queries
  // 2. More efficient filtering logic
  // 3. Parallel operations where possible
  // 4. Early returns for common cases

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
      `✅ Fetched ${promProducts.length} Prom, ${rozetkaProducts.length} Rozetka products`
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
      `📦 Existing: ${existingPromIds.size} Prom, ${existingRozetkaIds.size} Rozetka, ${existingSKUs.size} SKUs`
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
            matchingRozetkaProduct.stockQuantity
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

    // OPTIMIZATION 6: Execute batch creates in parallel (not sequentially)
    const createPromises: Promise<any>[] = []

    // Prom products batch
    if (promCreateOperations.length > 0) {
      createPromises.push(
        prisma
          .$transaction(
            promCreateOperations.map((data) => prisma.products.create({ data }))
          )
          .then(() => {
            result.productsCreatedFromProm = promCreateOperations.length
            console.log(
              `✅ Created ${promCreateOperations.length} Prom-sourced products`
            )
          })
          .catch((error: any) => {
            console.error('Error in Prom batch creation:', error)
            result.errors.push(`Prom batch creation failed: ${error.message}`)
            result.success = false
          })
      )
    }

    // OPTIMIZATION 7: Filter Rozetka-only products more efficiently
    const rozetkaOnlyProducts = newRozetkaProducts.filter(
      (p) => !p.sku || !matchedRozetkaSKUs.has(p.sku)
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
              prisma.products.create({ data })
            )
          )
          .then(() => {
            result.productsCreatedFromRozetka = rozetkaCreateOperations.length
            console.log(
              `✅ Created ${rozetkaCreateOperations.length} Rozetka-only products`
            )
          })
          .catch((error: any) => {
            console.error('Error in Rozetka batch creation:', error)
            result.errors.push(
              `Rozetka batch creation failed: ${error.message}`
            )
            result.success = false
          })
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
    promProduct: PromProductData
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
    rozetkaProduct: RozetkaProductData
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
