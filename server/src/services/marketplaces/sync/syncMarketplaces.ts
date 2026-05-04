// server/src/services/marketplaces/sync/syncMarketplaces.ts
//import cron from 'node-cron'

import prisma from '../../../config/database'
import {
  fetchPromProductsWithTransformation,
} from '../../data-fetchers/fetchPromProducts'
import { fetchRozetkaProducts } from '../../data-fetchers/fetchRozetkaProducts'
import {
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

/* 
* This function performs a full synchronization of product quantities between the internal database and connected marketplaces (Prom and Rozetka). It updates the internal product records based on the latest data from marketplaces. Marketplaces --> internal DB. Not the other way around!!!
*
* It first fetches the latest product data from Prom, updates the internal database accordingly (including handling orphaned products), and then fetches Rozetka data to update Rozetka-specific quantities. 
* Note: This function is designed to be run periodically (e.g., via a cron job) to ensure that the internal database remains in sync with marketplace data. It can also be used as a manual sync trigger when needed.
 */
const updateAllMarketplaceQuantities = async () => {
  console.log('Updating all marketplace quantities for all products...')

  // First, fetch and sync Prom products as main source
  console.log('🔄 Fetching Prom products data...')
  const promProducts = await fetchPromProductsWithTransformation()
  console.log(`Fetched ${promProducts.length} Prom products`)

  const promProductIds = new Set(promProducts.map((p) => p.productId))

  // Find products in our DB that are NOT in the latest Prom fetch.
  const productsInDb = await prisma.products.findMany({
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

  const productsWithRozetka = allProducts.flatMap((p) => {
    const rozetka = (p.externalIds as any)?.rozetka
    return rozetka ? [{ ...p, rozetkaInfo: rozetka }] : [] // Return array with 1 item or empty array
  })

  console.log(`Found ${productsWithRozetka.length} products with Rozetka IDs`)
  console.log('example of a product with Rozetka ID:', productsWithRozetka[0])

  // Process Rozetka products (updates only rozetkaQuantity)
  if (productsWithRozetka.length > 0) {
    try {
      console.log('🔄 Fetching ALL Rozetka products data...')
      const rozetkaProducts = await fetchRozetkaProducts()
      const rozetkaProductsMap = new Map(
        rozetkaProducts.map((p) => [p.rz_item_id.toString(), p]),
      )

      // Simplified transaction logic using pre-extracted rozetkaInfo
      await prisma.$transaction(
        productsWithRozetka.map((product) => {
          const rozetkaProduct = rozetkaProductsMap.get(
            product.rozetkaInfo.rz_item_id,
          )

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