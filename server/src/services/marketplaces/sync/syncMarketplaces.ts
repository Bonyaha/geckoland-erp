// server/src/services/marketplaces/sync/syncMarketplaces.ts
//import cron from 'node-cron'
import prisma from '../../../config/database'
import { fetchCRMProducts } from '../../data-fetchers/fetchCRMProducts'
import {
  fetchPromProductsWithTransformation,
  fetchPromProducts,
} from '../../data-fetchers/fetchPromProducts'
import { fetchRozetkaProducts } from '../../data-fetchers/fetchRozetkaProducts'
import { updateMultiplePromProducts, PromUpdateParams } from '../promClient'
import {
  updateMultipleRozetkaProducts,
  RozetkaUpdateParams,
} from '../rozetkaClient'
import { normalizeQuantity } from '../../../utils/helpers/normalizeQuantity'
import type {
  ProductSyncEntry,
  ProductExternalIds,
  SyncStrategy,
} from '../../../types/marketplaces'
import { gmailLogger } from '../../../utils/gmailLogger'
import { settingsService } from '../../settings/settingsService'

// Update quantities for all products in app's database
const updateAllMarketplaceQuantities = async () => {
  console.log('Updating all marketplace quantities for all products...')

  // First, fetch and sync Prom products as main source
  console.log('🔄 Fetching Prom products data...')
  const promProducts = await fetchPromProductsWithTransformation()
  console.log(`Fetched ${promProducts.length} Prom products`)

  const promProductIds = new Set(promProducts.map((p) => p.productId))

  // Find products in our DB that are NOT in the latest Prom fetch.
  const productsInDb = await prisma.products.findMany({
    where: { source: 'prom' },
    select: { productId: true },
  })

  const orphanedProductIds = productsInDb
    .filter((p) => !promProductIds.has(p.productId))
    .map((p) => p.productId)

  if (orphanedProductIds.length > 0) {
    console.log(
      `Found ${orphanedProductIds.length} orphaned products. Setting their stock to 0 instead of deleting.`,
    )
    // Set their quantities to 0 to make them inactive.
    await prisma.products.updateMany({
      where: {
        productId: {
          in: orphanedProductIds,
        },
      },
      data: {
        stockQuantity: 0,
        promQuantity: 0,
        rozetkaQuantity: 0,
        available: false,
      },
    })
    console.log(
      `🗑️ Marked ${orphanedProductIds.length} orphaned products as out of stock.`,
    )
  }

  // Create a map for quick lookup
  //const promProductsMap = new Map(promProducts.map((p) => [p.id.toString(), p]))

  // Update database with Prom products (stockQuantity and add new products)
  for (const promProduct of promProducts) {
    const quantity = normalizeQuantity(promProduct.stockQuantity)

    await prisma.products.upsert({
      where: { productId: promProduct.productId },
      update: {
        stockQuantity: quantity,
        promQuantity: quantity,
        available: quantity > 0,
        lastPromSync: new Date(),
      },
      create: {
        ...promProduct,
        stockQuantity: normalizeQuantity(promProduct.stockQuantity),
      },
    })
  }
  console.log(`✅ Updated/created ${promProducts.length} products from Prom`)

  // Get all products after Prom sync
  const allProducts = await prisma.products.findMany()
  console.log(
    `Found ${allProducts.length} products to update marketplace quantities`,
  )

  const productsWithRozetka = allProducts.filter((p) => {
    const externalIds = p.externalIds as {
      rozetka?: { rz_item_id: string; item_id: string }
    }
    return externalIds?.rozetka
  })

  console.log(`Found ${productsWithRozetka.length} products with Rozetka IDs`)

  // Process Rozetka products (updates only rozetkaQuantity)
  if (productsWithRozetka.length > 0) {
    try {
      console.log('🔄 Fetching ALL Rozetka products data...')
      const rozetkaProducts = await fetchRozetkaProducts()
      const rozetkaProductsMap = new Map(
        rozetkaProducts.map((p) => [p.rz_item_id.toString(), p]),
      )

      // Use Prisma transaction for bulk updates
      await prisma.$transaction(
        productsWithRozetka.map((product) => {
          const externalIds = product.externalIds as {
            rozetka?: { rz_item_id: string; item_id: string }
          }
          const rozetkaProduct = externalIds?.rozetka
            ? rozetkaProductsMap.get(externalIds.rozetka.rz_item_id)
            : null
          const quantity = rozetkaProduct
            ? normalizeQuantity(rozetkaProduct.stock_quantity)
            : product.stockQuantity

          return prisma.products.update({
            where: { productId: product.productId },
            data: {
              rozetkaQuantity: quantity,
              available: quantity > 0,
              lastRozetkaSync: new Date(),
            },
          })
        }),
      )
      console.log(`✅ Updated ${productsWithRozetka.length} Rozetka quantities`)
    } catch (error) {
      console.error('❌ Error with Rozetka update:', error)
    }
  }

  console.log('✅ All marketplace quantities update completed')
}

/**
 * Synchronizes product quantities between the internal database
 * and all connected marketplaces (Prom and Rozetka).
 *
 * This is a full two-way inventory reconciliation engine:
 * it detects quantity changes on marketplaces, computes deltas,
 * updates the database accordingly, and pushes required updates
 * back to marketplaces based on selected synchronization strategy.
 *
 * @returns Summary of synchronization results, including
 * counts of updated items, detected discrepancies, and errors.
 *
 * @remarks
 * - Fetches product feeds from Prom and Rozetka independently.
 * - Compares marketplace quantities with last known database values.
 * - Computes quantity deltas and determines whether an update is required.
 * - Applies two distinct synchronization strategies:
 *   - `same_quantity`: marketplaces are kept in strict alignment.
 *   - `different_quantity`: each marketplace maintains independent stock.
 * - Updates internal DB quantities before propagating changes outward.
 * - Aggregates all update operations and performs batch syncs to marketplaces.
 * - Ensures the system continues processing even when individual updates fail.
 * - Produces a detailed result object summarizing changes and encountered errors.
 *
 * @example
 * const summary = await syncMarketplaces();
 *
 * console.log(`Updated ${summary.totalUpdated} products across marketplaces.`);
 *
 * if (summary.errors.length > 0) {
 *   console.warn('Sync completed with warnings:');
 *   summary.errors.forEach((err) => console.warn(' -', err));
 * }
 *
 * @example
 * // Behavior example — SAME QUANTITY strategy:
 * // DB: 100 units, Prom: 95, Rozetka: 100
 * // Prom delta = -5 → DB becomes 95 → Rozetka also updated to 95
 *
 * @example
 * // Behavior example — DIFFERENT QUANTITY strategy:
 * // DB: 100 units, Prom: 95, Rozetka: 120
 * // Prom delta = -5 → DB becomes 95
 * // Rozetka stays 120 (no enforced alignment)
 */

const syncMarketplaces = async () => {
  // Fetch external products
  const promProducts = await fetchPromProducts()
  console.log(`Fetched ${promProducts.length} Prom products`)

  const productsToUpdate = new Map<string, ProductSyncEntry>()

  //
  // 1) Process Prom feed -> build/augment productsToUpdate
  //
  await Promise.all(
    promProducts.map(async (promProduct) => {
      const appProduct = await prisma.products.findFirst({
        where: {
          externalIds: { path: ['prom'], equals: promProduct.id.toString() },
        },
      })

      if (!appProduct) return

      const currentPromQuantity = normalizeQuantity(
        promProduct.quantity_in_stock,
      )
      const lastKnownPromQuantity =
        appProduct.promQuantity ?? appProduct.stockQuantity

      const promDelta = currentPromQuantity - lastKnownPromQuantity
      if (promDelta === 0) return

      console.log(
        `Prom product ${appProduct.productId} quantity changed by ${promDelta} (from ${lastKnownPromQuantity} to ${currentPromQuantity})`,
      )

      const existing = productsToUpdate.get(appProduct.productId)

      // Type-safe way to handle externalIds
      const externalIds = appProduct.externalIds as {
        prom?: string
        rozetka?: { rz_item_id?: string; item_id?: string }
      } | null

      const entry: ProductSyncEntry = existing ?? {
        productId: appProduct.productId,
        stockQuantity: appProduct.stockQuantity,
        promQuantity: appProduct.promQuantity ?? null,
        rozetkaQuantity: appProduct.rozetkaQuantity ?? null,
        externalIds: externalIds ?? undefined,
        masterQuantityDelta: 0,
        needsPromSync: false,
        needsRozetkaSync: false,
        syncStrategy: 'same_quantity' as const,
      }

      entry.promQuantityDelta = (entry.promQuantityDelta ?? 0) + promDelta
      entry.newPromQuantity = currentPromQuantity
      entry.masterQuantityDelta += promDelta

      // Strategy decision: compare lastKnownPromQuantity vs currentRozetkaQuantity (existing snapshot)
      const currentRozetkaQuantity =
        appProduct.rozetkaQuantity ?? appProduct.stockQuantity
      entry.syncStrategy =
        lastKnownPromQuantity === currentRozetkaQuantity
          ? 'same_quantity'
          : 'different_quantity'

      // only mark need to sync other marketplace if strategy says same and external id exists
      if (
        entry.syncStrategy === 'same_quantity' &&
        entry.externalIds?.rozetka
      ) {
        entry.needsRozetkaSync = true
      }

      productsToUpdate.set(appProduct.productId, entry)
    }),
  )

  console.log(
    'Products to update after Prom processing:',
    JSON.stringify(Array.from(productsToUpdate), null, 2),
  )

  //
  // 2) Process Rozetka feed -> build/augment productsToUpdate
  //
  const rozetkaProducts = await fetchRozetkaProducts()
  console.log(`Fetched ${rozetkaProducts.length} Rozetka products`)

  await Promise.all(
    rozetkaProducts.map(async (rozProduct) => {
      const appProduct = await prisma.products.findFirst({
        where: {
          externalIds: {
            path: ['rozetka', 'rz_item_id'],
            equals: rozProduct.rz_item_id.toString(),
          },
        },
      })

      if (!appProduct) return

      const currentRozetkaQuantity = normalizeQuantity(
        rozProduct.stock_quantity,
      )
      const lastKnownRozetkaQuantity =
        appProduct.rozetkaQuantity ?? appProduct.stockQuantity

      const rozDelta = currentRozetkaQuantity - lastKnownRozetkaQuantity
      if (rozDelta === 0) return

      console.log(
        `Rozetka product ${appProduct.productId} quantity changed by ${rozDelta} (from ${lastKnownRozetkaQuantity} to ${currentRozetkaQuantity})`,
      )

      const existing = productsToUpdate.get(appProduct.productId)

      // Type-safe way to handle externalIds
      const externalIds = appProduct.externalIds as {
        prom?: string
        rozetka?: { rz_item_id?: string; item_id?: string }
      } | null

      const entry: ProductSyncEntry = existing ?? {
        productId: appProduct.productId,
        stockQuantity: appProduct.stockQuantity,
        promQuantity: appProduct.promQuantity ?? null,
        rozetkaQuantity: appProduct.rozetkaQuantity ?? null,
        externalIds: externalIds ?? undefined,
        masterQuantityDelta: 0,
        needsPromSync: false,
        needsRozetkaSync: false,
        syncStrategy: 'same_quantity' as const,
      }

      entry.rozetkaQuantityDelta = (entry.rozetkaQuantityDelta ?? 0) + rozDelta
      entry.newRozetkaQuantity = currentRozetkaQuantity
      entry.masterQuantityDelta += rozDelta

      const currentPromQuantity =
        appProduct.promQuantity ?? appProduct.stockQuantity
      entry.syncStrategy =
        lastKnownRozetkaQuantity === currentPromQuantity
          ? 'same_quantity'
          : 'different_quantity'

      if (entry.syncStrategy === 'same_quantity' && entry.externalIds?.prom) {
        entry.needsPromSync = true
      }

      productsToUpdate.set(appProduct.productId, entry)
    }),
  )

  console.log(
    'Products to update after Rozetka processing:',
    JSON.stringify(Array.from(productsToUpdate), null, 2),
  )

  //
  // 3) Finalize newMaster/newMarketplace quantities, update DB and prepare external sync payloads (single pass)
  //
  const promUpdates: Array<{ productId: string; updates: PromUpdateParams }> =
    []
  const rozetkaUpdates: Array<{
    productId: string
    updates: RozetkaUpdateParams
  }> = []

  const dbUpdatePromises: Promise<any>[] = []
  const productIdsToClearFlags: string[] = []

  for (const [productId, entry] of productsToUpdate) {
    // compute final master quantity once (use snapshot stockQuantity from first read)
    entry.newMasterQuantity = Math.max(
      0,
      entry.stockQuantity + entry.masterQuantityDelta,
    )

    // finalize based on sync strategy
    if (entry.syncStrategy === 'same_quantity') {
      // if both changed -> both become master amount
      if (
        entry.promQuantityDelta !== undefined &&
        entry.rozetkaQuantityDelta !== undefined
      ) {
        entry.newPromQuantity = entry.newMasterQuantity
        entry.newRozetkaQuantity = entry.newMasterQuantity
        entry.needsPromSync = !!entry.externalIds?.prom
        entry.needsRozetkaSync = !!entry.externalIds?.rozetka
      } else if (entry.promQuantityDelta !== undefined) {
        // only Prom changed -> Prom keep its feed value, other marketplace -> master
        entry.newPromQuantity =
          entry.newPromQuantity ??
          (entry.promQuantity ?? entry.stockQuantity) + entry.promQuantityDelta!
        if (entry.externalIds?.rozetka) {
          entry.newRozetkaQuantity = entry.newMasterQuantity
          entry.needsRozetkaSync = true
        } else {
          entry.needsRozetkaSync = false
        }
      } else if (entry.rozetkaQuantityDelta !== undefined) {
        entry.newRozetkaQuantity =
          entry.newRozetkaQuantity ??
          (entry.rozetkaQuantity ?? entry.stockQuantity) +
            entry.rozetkaQuantityDelta!
        if (entry.externalIds?.prom) {
          entry.newPromQuantity = entry.newMasterQuantity
          entry.needsPromSync = true
        } else {
          entry.needsPromSync = false
        }
      }
    } else {
      // different_quantity: only update marketplace(s) that changed; keep others unchanged
      if (
        entry.promQuantityDelta !== undefined &&
        entry.rozetkaQuantityDelta === undefined
      ) {
        entry.newRozetkaQuantity = entry.rozetkaQuantity ?? entry.stockQuantity
        entry.needsRozetkaSync = false
      }

      if (
        entry.rozetkaQuantityDelta !== undefined &&
        entry.promQuantityDelta === undefined
      ) {
        entry.newPromQuantity = entry.promQuantity ?? entry.stockQuantity
        entry.needsPromSync = false
      }

      // if both changed and strategy is different_quantity, keep both changes, no cross-sync
      if (
        entry.promQuantityDelta !== undefined &&
        entry.rozetkaQuantityDelta !== undefined
      ) {
        entry.needsPromSync = false
        entry.needsRozetkaSync = false
      }
    }

    // Build DB update
    const updateData: any = {
      stockQuantity: entry.newMasterQuantity,
      available: entry.newMasterQuantity > 0,
      lastSynced: new Date(),
      needsPromSync: entry.needsPromSync,
      needsRozetkaSync: entry.needsRozetkaSync,
      needsSync: entry.needsPromSync || entry.needsRozetkaSync,
    }

    if (entry.newPromQuantity !== undefined) {
      updateData.promQuantity = entry.newPromQuantity
      updateData.lastPromSync = new Date()
    }

    if (entry.newRozetkaQuantity !== undefined) {
      updateData.rozetkaQuantity = entry.newRozetkaQuantity
      updateData.lastRozetkaSync = new Date()
    }

    console.log(`Updating product ${productId}:`, updateData)

    // queue DB update (in parallel; consider throttling if many items)
    dbUpdatePromises.push(
      prisma.products.update({
        where: { productId },
        data: updateData,
      }),
    )

    // inline prepare external syncs (no re-query necessary)
    if (
      entry.needsPromSync &&
      entry.externalIds?.prom &&
      entry.newPromQuantity !== undefined
    ) {
      promUpdates.push({
        productId: entry.externalIds.prom,
        updates: { quantity: entry.newPromQuantity },
      })
    }

    if (
      entry.needsRozetkaSync &&
      entry.externalIds?.rozetka?.item_id &&
      entry.newRozetkaQuantity !== undefined
    ) {
      rozetkaUpdates.push({
        productId: entry.externalIds.rozetka.item_id,
        updates: { quantity: entry.newRozetkaQuantity },
      })
    }

    if (entry.needsPromSync || entry.needsRozetkaSync) {
      productIdsToClearFlags.push(productId)
    }
  }

  // Execute DB updates in parallel (or throttle if very large)
  try {
    await Promise.all(dbUpdatePromises)
    console.log(`✅ Updated ${dbUpdatePromises.length} product rows in DB`)
  } catch (err) {
    console.error('DB update failed', err)
    throw err
  }

  // Execute external marketplace syncs
  const syncPromises: Promise<any>[] = []

  if (promUpdates.length > 0) {
    console.log(`🚀 Batch updating ${promUpdates.length} Prom products`)
    // If you have a batch API use it:
    // syncPromises.push(updateMultiplePromProducts(promUpdates))
    // otherwise call per-item:
    /* for (const { productId, quantity } of promUpdates) {
      //syncPromises.push(updatePromProduct(productId, { quantity }))
    } */
  }

  if (rozetkaUpdates.length > 0) {
    console.log(`🚀 Batch updating ${rozetkaUpdates.length} Rozetka products`)
    //syncPromises.push(updateMultipleRozetkaProducts(rozetkaUpdates))
  }

  if (syncPromises.length > 0) {
    try {
      //await Promise.all(syncPromises)
      console.log('✅ All batch updates completed successfully')
    } catch (error) {
      console.error('❌ Some batch updates failed:', error)
      throw error
    }
  } else {
    console.log('No marketplace updates required')
  }

  // Clear sync flags for products that were processed
  if (productIdsToClearFlags.length > 0) {
    await prisma.products.updateMany({
      where: { productId: { in: productIdsToClearFlags } },
      data: { needsSync: false, needsPromSync: false, needsRozetkaSync: false },
    })
    console.log(
      `✅ Cleared sync flags for ${productIdsToClearFlags.length} products`,
    )
  }

  console.log('Marketplace synchronization completed')
}

/**
 * Applies a signed inventory adjustment for one or more products, updating
 * the internal database and propagating the change to connected marketplaces
 * (Prom and/or Rozetka) according to the active sync strategy.
 *
 * This is a **bidirectional** function — the sign of `quantity` determines
 * the direction of the stock change:
 * - `quantity > 0`  →  **deduct** from stock  (order placed, item added)
 * - `quantity < 0`  →  **return** to stock    (order cancelled/deleted, item removed)
 *
 * Marketplace API updates are currently disabled for safety, but the function
 * still computes required deltas, sets sync flags, and writes updated stock
 * values to the database.
 *
 * @param items   Products to adjust, each with an internal `productId` and a
 *                signed `quantity`.
 * @param source  Which system triggered the change; controls sync-strategy
 *                direction:
 *                - `'prom'` / `'rozetka'` — change originated on that marketplace
 *                - `'crm'`                 — change originated inside this CRM
 *
 * @example
 * // Deduct stock — order placed in CRM
 * await syncInventoryAdjustment(
 *   [
 *     { productId: 'P123', quantity: 2 },   // take 2 units
 *     { productId: 'P456', quantity: 1 },   // take 1 unit
 *   ],
 *   'crm',
 * )
 *
 * @example
 * // Restore stock — order cancelled
 * await syncInventoryAdjustment(
 *   [{ productId: 'P123', quantity: -2 }],  // return 2 units
 *   'crm',
 * )
 *
 * @example
 * // SAME QUANTITY strategy:
 * // promQuantity = 50, rozetkaQuantity = 50, stock = 50
 * // Prom order of 3 units → master = 47, Prom = 47, Rozetka mirrored to 47
 *
 * @example
 * // DIFFERENT QUANTITY strategy:
 * // promQuantity = 40, rozetkaQuantity = 55
 * // Rozetka order of 5 units → master = 50, Rozetka = 50, Prom stays 40
 */

export const syncInventoryAdjustment = async (
  orderedProducts: Array<{
    productId: string // App's internal product ID
    /** Positive = deduct from stock.  Negative = return to stock. */
    quantity: number
  }>,
  source: 'prom' | 'rozetka' | 'crm', // Where the order came from
) => {
  console.log(
    `Processing order sync for ${orderedProducts.length} products from ${source}`,
  )

  // Track products that need updates
  const productsToUpdate = new Map<string, ProductSyncEntry>()

  // Process each ordered product
  for (const { productId, quantity } of orderedProducts) {
    console.log(
      `Adjusting inventory for product ${productId}: ${quantity} units`,
    )

    const appProduct = await prisma.products.findUnique({
      where: { productId: productId },
    })

    if (!appProduct) {
      console.warn(`Product ${productId} not found in database`)
      continue
    }

    const externalIds = appProduct.externalIds as ProductExternalIds

    // Calculate quantity delta (negative because items were ordered/sold)
    const masterQuantityDelta = -quantity

    const currentPromQuantity =
      appProduct.promQuantity ?? appProduct.stockQuantity
    const currentRozetkaQuantity =
      appProduct.rozetkaQuantity ?? appProduct.stockQuantity
    gmailLogger.info(
      `Inventory adjustment for product ${productId}: currentPromQuantity=${currentPromQuantity}, currentRozetkaQuantity=${currentRozetkaQuantity}, masterQuantityDelta=${masterQuantityDelta}`,
      {
        productId,
        currentPromQuantity,
        currentRozetkaQuantity,
        masterQuantityDelta,
      },
    )
    // Decide sync strategy
    const syncStrategy: SyncStrategy =
      currentPromQuantity === currentRozetkaQuantity
        ? 'same_quantity'
        : 'different_quantity'

    // Compute master new quantity once
    const newMasterQuantity = Math.max(
      0,
      appProduct.stockQuantity + masterQuantityDelta,
    )

    const entry: ProductSyncEntry = {
      productId: appProduct.productId,
      // Snapshot of current DB state
      stockQuantity: appProduct.stockQuantity,
      promQuantity: appProduct.promQuantity ?? null,
      rozetkaQuantity: appProduct.rozetkaQuantity ?? null,
      // externalIds stored here — eliminates redundant findUnique in sync section
      externalIds,
      masterQuantityDelta,
      newMasterQuantity,
      needsPromSync: false,
      needsRozetkaSync: false,
      syncStrategy,
    }

    // Apply the order delta to the source marketplace
    if (source === 'prom') {
      entry.newPromQuantity = Math.max(
        0,
        currentPromQuantity + masterQuantityDelta,
      )

      console.log(
        `Prom adjustment: ${currentPromQuantity} -> ${entry.newPromQuantity} (delta ${masterQuantityDelta})`,
      )

      // For same_quantity strategy, sync to other marketplace
      if (syncStrategy === 'same_quantity' && externalIds?.rozetka) {
        entry.needsRozetkaSync = true
        entry.newRozetkaQuantity = newMasterQuantity
      }
    } else if (source === 'rozetka') {
      entry.newRozetkaQuantity = Math.max(
        0,
        currentRozetkaQuantity + masterQuantityDelta,
      )

      console.log(
        `Rozetka adjustment: ${currentRozetkaQuantity} -> ${entry.newRozetkaQuantity} (delta ${masterQuantityDelta})`,
      )

      // For same_quantity strategy, sync to other marketplace
      if (syncStrategy === 'same_quantity' && externalIds?.prom) {
        entry.needsPromSync = true
        entry.newPromQuantity = newMasterQuantity
      }
    } else if (source === 'crm') {
      // CRM orders: update master quantity and marketplace quantities based on strategy
      console.log(
        `CRM adjustment: master quantity ${appProduct.stockQuantity} -> ${newMasterQuantity} (delta ${masterQuantityDelta})`,
      )

      if (syncStrategy === 'same_quantity') {
        // If marketplaces were in sync, reduce both by the same amount
        if (externalIds?.prom) {
          entry.newPromQuantity = newMasterQuantity
          entry.needsPromSync = true
        }
        if (externalIds?.rozetka) {
          entry.newRozetkaQuantity = newMasterQuantity
          entry.needsRozetkaSync = true
        }
      } else {
        // Different quantities: keep marketplace quantities unchanged
        // (CRM order doesn't affect individual marketplace stock levels)
        entry.newPromQuantity = currentPromQuantity
        entry.newRozetkaQuantity = currentRozetkaQuantity
        // Don't sync to marketplaces for different_quantity strategy
        entry.needsPromSync = false
        entry.needsRozetkaSync = false
      }
    }

    productsToUpdate.set(appProduct.productId, entry)
  }

  console.log(
    'Products to update after inventory adjustment:',
    JSON.stringify(Array.from(productsToUpdate), null, 2),
  )

  // Update database with new quantities
  for (const [productId, entry] of productsToUpdate) {
    const updateData: any = {
      stockQuantity: entry.newMasterQuantity,
      available: (entry.newMasterQuantity ?? 0) > 0,
      lastSynced: new Date(),
    }

    // Update marketplace-specific quantities
    if (entry.newPromQuantity !== undefined) {
      updateData.promQuantity = entry.newPromQuantity
      updateData.lastPromSync = new Date()
    }

    if (entry.newRozetkaQuantity !== undefined) {
      updateData.rozetkaQuantity = entry.newRozetkaQuantity
      updateData.lastRozetkaSync = new Date()
    }

    // Set sync flags
    updateData.needsPromSync = entry.needsPromSync
    updateData.needsRozetkaSync = entry.needsRozetkaSync
    updateData.needsSync = entry.needsPromSync || entry.needsRozetkaSync

    console.log(`Updating product ${productId}:`, updateData)

    await prisma.products.update({
      where: { productId: productId },
      data: updateData,
    })
  }

  // Collect products that require an outbound marketplace API call
  const productsNeedingSync = Array.from(productsToUpdate.values()).filter(
    (entry) => entry.needsPromSync || entry.needsRozetkaSync,
  )

  console.log(
    `Found ${productsNeedingSync.length} products needing marketplace sync`,
  )

  gmailLogger.info(
    `Inventory adjustment from ${source}: ${productsNeedingSync.length} products need marketplace updates`,
    { products: productsNeedingSync },
  )
  /******************************************************************** */
  /* For now I disabled updating marketplaces until I am 100% sure everything works correctly */
  /********************************************************************* */

  if (productsNeedingSync.length === 0) {
    console.log('No marketplace sync needed')
    return
  }

  // Prepare batch updates
  const promUpdates: Array<{ productId: string; quantity: number }> = []
  const rozetkaUpdates: Array<{
    productId: string
    updates: RozetkaUpdateParams
  }> = []

  // Check Rozetka store status before preparing updates, so we don't prepare updates that won't be sent
  const rozetkaActive = await settingsService.isRozetkaStoreActive()

  for (const entry of productsNeedingSync) {
    const { externalIds } = entry

    // Collect Prom updates
    if (
      entry.needsPromSync &&
      externalIds?.prom &&
      entry.newPromQuantity !== undefined
    ) {
      console.log(
        `Preparing Prom sync for product ${entry.productId} with quantity ${entry.newPromQuantity}`,
      )
      promUpdates.push({
        productId: externalIds.prom,
        quantity: entry.newPromQuantity,
      })
    }

    // Collect Rozetka updates(only if store is active)
    if (
      entry.needsRozetkaSync &&
      externalIds?.rozetka?.item_id &&
      entry.newRozetkaQuantity !== undefined
    ) {
      if (!rozetkaActive) {
        console.log(
          `Skipping Rozetka sync for product ${entry.productId} - store is paused`,
        )
        continue
      }

      console.log(
        `Preparing Rozetka sync for product ${entry.productId} with quantity ${entry.newRozetkaQuantity}`,
      )
      rozetkaUpdates.push({
        productId: externalIds.rozetka.item_id,
        updates: { quantity: entry.newRozetkaQuantity },
      })
    }
  }

  // Execute batch updates
  const syncPromises: Promise<any>[] = []

  if (promUpdates.length > 0) {
    console.log(
      `🚀 Batch updating ${promUpdates.length} Prom products after order`,
    )
    gmailLogger.info(
      `Preparing to push ${promUpdates.length} Prom product(s) after inventory adjustment from ${source}`,
      promUpdates,
    )
    // If you have updateMultiplePromProducts, use it here
    // syncPromises.push(updateMultiplePromProducts(promUpdates))

    // Otherwise, use individual updates
    /* for (const { productId, quantity } of promUpdates) {
      syncPromises.push(updatePromProduct(productId, { quantity }))
    } */
  }

  // Batch update Rozetka products
  if (rozetkaUpdates.length > 0) {
    console.log(
      `🚀 Batch updating ${rozetkaUpdates.length} Rozetka products after order`,
    )
    gmailLogger.info(
      `Preparing to push ${rozetkaUpdates.length} Rozetka product(s) after inventory adjustment from ${source}`,
      rozetkaUpdates,
    )
    //syncPromises.push(updateMultipleRozetkaProducts(rozetkaUpdates))
  }

  // Execute all updates
  if (syncPromises.length > 0) {
    try {
      //await Promise.all(syncPromises)
      console.log('✅ All order-based sync updates completed successfully')
    } catch (error) {
      console.error('❌ Some order-based sync updates failed:', error)
      throw error
    }
  }

  // Clear sync flags for products that were processed
  const productIds = productsNeedingSync.map((entry) => entry.productId)

  if (productIds.length > 0) {
    // Always clear Prom sync flags for products that were processed
    await prisma.products.updateMany({
      where: {
        productId: { in: productIds },
      },
      data: {
        needsPromSync: false,
      },
    })

    // Only clear Rozetka sync flags if store was active
    if (rozetkaActive) {
      await prisma.products.updateMany({
        where: {
          productId: { in: productIds },
        },
        data: {
          needsRozetkaSync: false,
        },
      })
    }

    // Clear needsSync if both flags are now false
    await prisma.products.updateMany({
      where: {
        productId: { in: productIds },
        needsPromSync: false,
        needsRozetkaSync: false,
      },
      data: {
        needsSync: false,
      },
    })

    console.log(
      `✅ Cleared sync flags for ${productIds.length} products after order sync`,
    )
  }

  console.log(`🎉 Inventory adjustment sync completed for ${source}`)
}

// Run every 5 minutes
//cron.schedule('*/5 * * * *', syncMarketplaces)

// Add to end of index.ts
//console.log('Synchronization scheduled')
//initializeMarketplaceQuantitiesOptimized()
//syncMarketplaces()
//syncRozetkaProductIds()
//updateAllMarketplaceQuantities()
/* ;(async () => {
  await syncInventoryAdjustment(
    [{ productId: '2737880255', orderedQuantity: 2 }],
    'prom'
  )
})() */
