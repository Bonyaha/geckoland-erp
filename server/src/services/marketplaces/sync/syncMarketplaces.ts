// server/src/services/marketplaces/sync/syncMarketplaces.ts
//import cron from 'node-cron'

import prisma from '../../../config/database'
import { fetchPromProductsWithTransformation } from '../../data-fetchers/fetchPromProducts'
import { fetchRozetkaProducts } from '../../data-fetchers/fetchRozetkaProducts'
import { RozetkaUpdateParams } from '../rozetkaClient'
import { normalizeQuantity } from '../../../utils/helpers/normalizeQuantity'
import type {
  ProductSyncEntry,
  SyncStrategy,
} from '../../../types/marketplaces'
import { gmailLogger } from '../../../utils/gmailLogger'
import { settingsService } from '../../settings/settingsService'

/*
 * This function performs a full synchronization of product quantities between the internal database and connected marketplaces (Prom and Rozetka). It updates the internal product records based on the latest data from marketplaces. Marketplaces --> internal DB. Not the other way around!!!
 *
 * It first fetches the latest product data from Prom, updates the internal database accordingly (including handling orphaned products), and then fetches Rozetka data to update Rozetka-specific quantities.
 * Note: This function is designed to be run periodically (e.g., via a cron job) to ensure that the internal database remains in sync with marketplace data. It can also be used as a manual sync trigger when needed.
 */

const updateAllMarketplaceQuantities = async () => {
  console.log('Updating all marketplace quantities for all products...')

  // 1. Fetch Prom products (Prom is the main stock source)
  console.log('🔄 Fetching Prom products data...')
  const promProducts = await fetchPromProductsWithTransformation()
  console.log(`Fetched ${promProducts.length} Prom products`)

  // Do not reconcile against an empty response.
  // An empty response could otherwise mark every product as out of stock.
  if (promProducts.length === 0) {
    console.warn(
      '⚠️ Prom returned no products. Skipping Prom and Rozetka quantity synchronization.',
    )
    return
  }

  // 2. Build a set of Prom external IDs.
  const promProductIds = new Set(
    promProducts.map((product) => String(product.promId ?? product.productId)),
  )

  // 3. Find only DB products that are linked to Prom.
  const promProductsInDb = await prisma.products.findMany({
    where: {
      promId: { not: null },
    },
    select: {
      productId: true,
      promId: true,
    },
  })

  // 4. Mark missing Prom listings as out of stock.
  const orphanedProductIds = promProductsInDb
    .filter(
      (product) =>
        product.promId !== null && !promProductIds.has(product.promId),
    )
    .map((product) => product.productId)

  if (orphanedProductIds.length > 0) {
    console.log(
      `Found ${orphanedProductIds.length} missing Prom listings. Setting stock to 0.`,
    )

    await prisma.products.updateMany({
      where: {
        productId: { in: orphanedProductIds },
      },
      data: {
        stockQuantity: 0,
        promQuantity: 0,
        available: false,
      },
    })
  }

  // 5. Update or create products using Prom's external ID as promId.
  for (const promProduct of promProducts) {
    const { productId: promExternalProductId, ...productData } = promProduct

    const promId = String(promProduct.promId ?? promExternalProductId)
    const quantity = normalizeQuantity(promProduct.stockQuantity)

    await prisma.products.upsert({
      where: { promId },
      update: {
        stockQuantity: quantity,
        promQuantity: quantity,
        available: quantity > 0,
        lastPromSync: new Date(),
      },
      create: {
        ...productData,
        promId,
        stockQuantity: quantity,
        promQuantity: quantity,
        available: quantity > 0,
        rozetkaItemId: promProduct.rozetkaItemId ?? null,
        rozetkaRzItemId: promProduct.rozetkaRzItemId ?? null,
        lastPromSync: new Date(),
      },
    })
  }

  console.log(`✅ Updated/created ${promProducts.length} products from Prom`)

  // 6. Get products after Prom synchronization.
  const allProducts = await prisma.products.findMany({
    select: {
      productId: true,
      stockQuantity: true,
      rozetkaItemId: true,
      rozetkaRzItemId: true,
    },
  })

  console.log(
    `Found ${allProducts.length} products to update marketplace quantities`,
  )

  const productsWithRozetka = allProducts.filter(
    (product) => product.rozetkaRzItemId != null,
  )

  console.log(`Found ${productsWithRozetka.length} products with Rozetka IDs`)

  // 7. Update Rozetka quantities.
  if (productsWithRozetka.length > 0) {
    try {
      console.log('🔄 Fetching ALL Rozetka products data...')
      const rozetkaProducts = await fetchRozetkaProducts()

      const rozetkaProductsMap = new Map(
        rozetkaProducts.map((product) => [
          product.rz_item_id.toString(),
          product,
        ]),
      )

      await prisma.$transaction(
        productsWithRozetka.map((product) => {
          const rozetkaProduct = product.rozetkaRzItemId
            ? rozetkaProductsMap.get(product.rozetkaRzItemId)
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

// Get active sync strategy to determine how to propagate changes between marketplaces
  const syncStrategy: SyncStrategy = await settingsService.getSyncStrategy()
  // Track products that need updates
  const productsToUpdate = new Map<string, ProductSyncEntry>()

  // Process each ordered product
  for (const { productId, quantity } of orderedProducts) {
    console.log(
      `Adjusting inventory for product ${productId}: ${quantity} units`,
    )

    const appProduct = await prisma.products.findUnique({
      where: { productId: productId },
      select: {
        productId: true,
        stockQuantity: true,
        promQuantity: true,
        rozetkaQuantity: true,
        promId: true,
        rozetkaItemId: true,
        rozetkaRzItemId: true,
      },
    })

    if (!appProduct) {
      console.warn(`Product ${productId} not found in database`)
      continue
    }

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
      promId: appProduct.promId ?? undefined,
      rozetkaItemId: appProduct.rozetkaItemId ?? undefined,
      rozetkaRzItemId: appProduct.rozetkaRzItemId ?? undefined,
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
      if (syncStrategy === 'same_quantity' && appProduct.rozetkaItemId) {
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
      if (syncStrategy === 'same_quantity' && appProduct.promId) {
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
        if (appProduct.promId) {
          entry.newPromQuantity = newMasterQuantity
          entry.needsPromSync = true
        }
        if (appProduct.rozetkaItemId) {
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

    // Collect Prom updates
    if (
      entry.needsPromSync &&
      entry.promId &&
      entry.newPromQuantity !== undefined
    ) {
      console.log(
        `Preparing Prom sync for product ${entry.productId} with quantity ${entry.newPromQuantity}`,
      )
      promUpdates.push({
        productId: entry.promId,
        quantity: entry.newPromQuantity,
      })
    }

    // Collect Rozetka updates(only if store is active)
    if (
      entry.needsRozetkaSync &&
      entry.rozetkaItemId &&
      entry.newRozetkaQuantity !== undefined
    ) {
      if (!rozetkaActive) {
        console.log(
          `Skipping Rozetka sync for product ${entry.productId} - store is paused`,
        )
        continue
      }
      /*  console.log(
        `Preparing Rozetka sync for product ${entry.productId} with quantity ${entry.newRozetkaQuantity}`,
      ) */
      rozetkaUpdates.push({
        productId: entry.rozetkaItemId,
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

/* ;(async () => {
  try {
    await updateAllMarketplaceQuantities()
    console.log('✅ Done')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
})() */
//npx tsx --env-file=.env src/services/marketplaces/sync/syncMarketplaces.ts - for running in terminal
