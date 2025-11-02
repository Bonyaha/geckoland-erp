//server\src\services\marketplaces\sync\syncMarketplaces.ts
//import cron from 'node-cron'
import prisma from '../../../config/database'
import { fetchCRMProducts } from '../../data-fetchers/fetchCRMProducts'
import {
  fetchPromProductsWithTransformation,
  fetchPromProducts,
} from '../../data-fetchers/fetchPromProducts'
import { fetchRozetkaProducts } from '../../data-fetchers/fetchRozetkaProducts'
import {
  updateMultiplePromProducts,
  PromUpdateParams,
} from '../promClient'
import {
  updateMultipleRozetkaProducts,
  RozetkaUpdateParams,
} from '../rozetkaClient'
import {
  normalizeQuantity} from './marketplaceSyncHelpers'


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
      `Found ${orphanedProductIds.length} orphaned products. Setting their stock to 0 instead of deleting.`
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
      `🗑️ Marked ${orphanedProductIds.length} orphaned products as out of stock.`
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
    `Found ${allProducts.length} products to update marketplace quantities`
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
        rozetkaProducts.map((p) => [p.rz_item_id.toString(), p])
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
              lastRozetkaSync: new Date(),
            },
          })
        })
      )
      console.log(`✅ Updated ${productsWithRozetka.length} Rozetka quantities`)
    } catch (error) {
      console.error('❌ Error with Rozetka update:', error)
    }
  }

  console.log('✅ All marketplace quantities update completed')
}

// Main function to sync marketplaces
// This will be called periodically to keep marketplace data in sync

const syncMarketplaces = async () => {
  // Fetch external products
  const promProducts = await fetchPromProducts()
  console.log(`Fetched ${promProducts.length} Prom products`)

  // Define the correct type for the Map value
  type ProductUpdateEntry = {
    productId: string
    // snapshot of app product fields to avoid re-fetching
    stockQuantity: number
    promQuantity?: number | null
    rozetkaQuantity?: number | null
    externalIds?: {
      prom?: string
      rozetka?: { rz_item_id?: string; item_id?: string }
    }

    // deltas from feeds (optional, kept because you rely on them)
    promQuantityDelta?: number
    rozetkaQuantityDelta?: number

    // accumulative change to the master stock
    masterQuantityDelta: number

    // final quantities we will write
    newPromQuantity?: number
    newRozetkaQuantity?: number
    newMasterQuantity?: number

    needsPromSync: boolean
    needsRozetkaSync: boolean
    syncStrategy: 'same_quantity' | 'different_quantity'
  }

  const productsToUpdate = new Map<string, ProductUpdateEntry>()

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
        promProduct.quantity_in_stock
      )
      const lastKnownPromQuantity =
        appProduct.promQuantity ?? appProduct.stockQuantity

      const promDelta = currentPromQuantity - lastKnownPromQuantity
      if (promDelta === 0) return

      console.log(
        `Prom product ${appProduct.productId} quantity changed by ${promDelta} (from ${lastKnownPromQuantity} to ${currentPromQuantity})`
      )

      const existing = productsToUpdate.get(appProduct.productId)

      // Type-safe way to handle externalIds
      const externalIds = appProduct.externalIds as {
        prom?: string
        rozetka?: { rz_item_id?: string; item_id?: string }
      } | null

      const entry: ProductUpdateEntry = existing ?? {
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
    })
  )

  console.log(
    'Products to update after Prom processing:',
    JSON.stringify(Array.from(productsToUpdate), null, 2)
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
        rozProduct.stock_quantity
      )
      const lastKnownRozetkaQuantity =
        appProduct.rozetkaQuantity ?? appProduct.stockQuantity

      const rozDelta = currentRozetkaQuantity - lastKnownRozetkaQuantity
      if (rozDelta === 0) return

      console.log(
        `Rozetka product ${appProduct.productId} quantity changed by ${rozDelta} (from ${lastKnownRozetkaQuantity} to ${currentRozetkaQuantity})`
      )

      const existing = productsToUpdate.get(appProduct.productId)

      // Type-safe way to handle externalIds
      const externalIds = appProduct.externalIds as {
        prom?: string
        rozetka?: { rz_item_id?: string; item_id?: string }
      } | null

      const entry: ProductUpdateEntry = existing ?? {
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
    })
  )

  console.log(
    'Products to update after Rozetka processing:',
    JSON.stringify(Array.from(productsToUpdate), null, 2)
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
      entry.stockQuantity + entry.masterQuantityDelta
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
      })
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
      `✅ Cleared sync flags for ${productIdsToClearFlags.length} products`
    )
  }

  console.log('Marketplace synchronization completed')
}

/**
 * Update product quantities in DB and sync to marketplaces after new order.
 * @param orderedProducts Array of items from the order, with productId and orderedProducts
 * @param sourceMarketplace 'prom' | 'rozetka' - where the order came from
 */

export const syncAfterOrder = async (
  orderedProducts: Array<{
    productId: string // App's internal product ID
    orderedQuantity: number // How many were ordered
  }>,
  sourceMarketplace: 'prom' | 'rozetka' // Where the order came from
) => {
  console.log(
    `🛒 Processing order sync for ${orderedProducts.length} products from ${sourceMarketplace}`
  )

  // Track products that need updates
  const productsToUpdate = new Map<
    string,
    {
      productId: string
      promQuantityDelta?: number
      rozetkaQuantityDelta?: number
      newPromQuantity?: number
      newRozetkaQuantity?: number
      needsPromSync: boolean
      needsRozetkaSync: boolean
      newMasterQuantity: number
      syncStrategy: 'same_quantity' | 'different_quantity'
    }
  >()

  // Process each ordered product
  for (const { productId, orderedQuantity } of orderedProducts) {
    console.log(
      `Processing order for product ${productId}: ${orderedQuantity} units`
    )

    const appProduct = await prisma.products.findUnique({
      where: { productId: productId },
    })

    if (!appProduct) {
      console.warn(`Product ${productId} not found in database`)
      continue
    }

    const externalIds = appProduct.externalIds as {
      prom?: string
      rozetka?: {
        rz_item_id: string
        item_id: string
      }
    }

    // Calculate quantity delta (negative because items were ordered/sold)
    const quantityDelta = -orderedQuantity

    const currentPromQuantity =
      appProduct.promQuantity ?? appProduct.stockQuantity
    const currentRozetkaQuantity =
      appProduct.rozetkaQuantity ?? appProduct.stockQuantity

    // Decide sync strategy
    const syncStrategy =
      currentPromQuantity === currentRozetkaQuantity
        ? 'same_quantity'
        : 'different_quantity'
    // Compute master new quantity once
    const newMasterQuantity = Math.max(
      0,
      appProduct.stockQuantity + quantityDelta
    )

    const update: {
      productId: string
      promQuantityDelta?: number
      rozetkaQuantityDelta?: number
      newPromQuantity?: number
      newRozetkaQuantity?: number
      needsPromSync: boolean
      needsRozetkaSync: boolean
      newMasterQuantity: number
      syncStrategy: 'same_quantity' | 'different_quantity'
    } = {
      productId: appProduct.productId,
      needsPromSync: false,
      needsRozetkaSync: false,
      newMasterQuantity,
      syncStrategy, // default strategy
    }

    // Apply the order delta to the source marketplace
    if (sourceMarketplace === 'prom') {
      update.newPromQuantity = Math.max(0, currentPromQuantity + quantityDelta)

      console.log(
        `Prom order: ${currentPromQuantity} -> ${update.newPromQuantity} (${quantityDelta})`
      )

      // For same_quantity strategy, sync to other marketplace
      if (syncStrategy === 'same_quantity' && externalIds?.rozetka) {
        update.needsRozetkaSync = true
        update.newRozetkaQuantity = newMasterQuantity
      }
    } else {
      update.newRozetkaQuantity = Math.max(
        0,
        currentRozetkaQuantity + quantityDelta
      )

      console.log(
        `Rozetka order: ${currentRozetkaQuantity} -> ${update.newRozetkaQuantity} (${quantityDelta})`
      )

      // For same_quantity strategy, sync to other marketplace
      if (syncStrategy === 'same_quantity' && externalIds?.prom) {
        update.needsPromSync = true
        update.newPromQuantity = newMasterQuantity
      }
    }

    productsToUpdate.set(appProduct.productId, update)
  }

  console.log(
    'Products to update after order processing:',
    JSON.stringify(Array.from(productsToUpdate), null, 2)
  )

  // Calculate new quantities for syncing based on strategy
  /* for (const [productId, update] of productsToUpdate) {
    const appProduct = await prisma.products.findUnique({
      where: { productId: productId },
    })

    if (!appProduct) continue

    console.log(
      `Processing sync strategy for product ${productId}: ${update.syncStrategy}`
    )

    if (update.syncStrategy === 'same_quantity') {
      // SAME QUANTITY STRATEGY: Both marketplaces should have the same final quantity
      const newMasterQuantity = Math.max(
        0,
        appProduct.stockQuantity + update.masterQuantityDelta
      )

      console.log(
        `Same quantity strategy: Master quantity ${appProduct.stockQuantity} + ${update.masterQuantityDelta} = ${newMasterQuantity}`
      )

      // Both marketplaces should sync to the new master quantity
      if (
        sourceMarketplace === 'prom' &&
        update.promQuantityDelta !== undefined
      ) {
        update.newRozetkaQuantity = newMasterQuantity // Sync Rozetka to master
        update.needsRozetkaSync = true
      }

      if (
        sourceMarketplace === 'rozetka' &&
        update.rozetkaQuantityDelta !== undefined
      ) {
        update.newPromQuantity = newMasterQuantity // Sync Prom to master
        update.needsPromSync = true
      }
    } else {
      // DIFFERENT QUANTITY STRATEGY: Only update the marketplace where order came from
      if (sourceMarketplace === 'prom') {
        // Keep Rozetka quantity unchanged
        const currentRozetkaQuantity =
          appProduct.rozetkaQuantity ?? appProduct.stockQuantity
        update.newRozetkaQuantity = currentRozetkaQuantity
        update.needsRozetkaSync = false

        console.log(
          `Different quantities - Prom order, keeping Rozetka unchanged at ${currentRozetkaQuantity}`
        )
      } else if (sourceMarketplace === 'rozetka') {
        // Keep Prom quantity unchanged
        const currentPromQuantity =
          appProduct.promQuantity ?? appProduct.stockQuantity
        update.newPromQuantity = currentPromQuantity
        update.needsPromSync = false

        console.log(
          `Different quantities - Rozetka order, keeping Prom unchanged at ${currentPromQuantity}`
        )
      }
    }
  }
  console.log(
    `productsToUpdate after finalizing quantities:`,
    JSON.stringify(Array.from(productsToUpdate), null, 2)
  ) */

  // Update database with new quantities
  for (const [productId, update] of productsToUpdate) {
    /* const appProduct = await prisma.products.findUnique({
      where: { productId: productId },
    })

    if (!appProduct) continue

    const newMasterQuantity = Math.max(
      0,
      appProduct.stockQuantity + update.masterQuantityDelta
    ) */

    const updateData: any = {
      stockQuantity: update.newMasterQuantity,
      lastSynced: new Date(),
    }

    // Update marketplace-specific quantities
    if (update.newPromQuantity !== undefined) {
      updateData.promQuantity = update.newPromQuantity
      updateData.lastPromSync = new Date()
    }

    if (update.newRozetkaQuantity !== undefined) {
      updateData.rozetkaQuantity = update.newRozetkaQuantity
      updateData.lastRozetkaSync = new Date()
    }

    // Set sync flags
    updateData.needsPromSync = update.needsPromSync
    updateData.needsRozetkaSync = update.needsRozetkaSync
    updateData.needsSync = update.needsPromSync || update.needsRozetkaSync

    console.log(`Updating product ${productId}:`, updateData)

    await prisma.products.update({
      where: { productId: productId },
      data: updateData,
    })
  }

  // Perform marketplace syncing for products that need it
  const productsNeedingSync = Array.from(productsToUpdate.values()).filter(
    (update) => update.needsPromSync || update.needsRozetkaSync
  )

  console.log(
    `Found ${productsNeedingSync.length} products needing marketplace sync`
  )

  /******************************************************************** */
  /* For now I disabled updating marketplaces until I am 100% sure everything works correctly */
  /********************************************************************* */

  /*if (productsNeedingSync.length === 0) {
    console.log('No marketplace sync needed')
    return
  }

  // Prepare batch updates
  const promUpdates: Array<{ productId: string; quantity: number }> = []
  const rozetkaUpdates: Array<{
    productId: string
    updates: RozetkaUpdateParams
  }> = []

  for (const update of productsNeedingSync) {
    const appProduct = await prisma.products.findUnique({
      where: { productId: update.productId },
    })

    if (!appProduct) continue

    const externalIds = appProduct.externalIds as {
      prom?: string
      rozetka?: {
        rz_item_id: string
        item_id: string
      }
    }

    // Collect Prom updates
    if (
      update.needsPromSync &&
      externalIds?.prom &&
      update.newPromQuantity !== undefined
    ) {
      console.log(
        `Preparing Prom sync for product ${update.productId} with quantity ${update.newPromQuantity}`
      )
      promUpdates.push({
        productId: externalIds.prom,
        quantity: update.newPromQuantity,
      })
    }

    // Collect Rozetka updates
    if (
      update.needsRozetkaSync &&
      externalIds?.rozetka &&
      update.newRozetkaQuantity !== undefined
    ) {
      console.log(
        `Preparing Rozetka sync for product ${update.productId} with quantity ${update.newRozetkaQuantity}`
      )
      rozetkaUpdates.push({
        productId: externalIds.rozetka.item_id,
        updates: { quantity: update.newRozetkaQuantity },
      })
    }
  }

  // Execute batch updates
  const syncPromises: Promise<any>[] = []

  if (promUpdates.length > 0) {
    console.log(
      `🚀 Batch updating ${promUpdates.length} Prom products after order`
    )
    // If you have updateMultiplePromProducts, use it here
    // syncPromises.push(updateMultiplePromProducts(promUpdates))

    // Otherwise, use individual updates
    for (const { productId, quantity } of promUpdates) {
      syncPromises.push(updatePromProduct(productId, { quantity }))
    }
  }

  // Batch update Rozetka products
  if (rozetkaUpdates.length > 0) {
    console.log(
      `🚀 Batch updating ${rozetkaUpdates.length} Rozetka products after order`
    )
    syncPromises.push(updateMultipleRozetkaProducts(rozetkaUpdates))
  }

  // Execute all updates
  if (syncPromises.length > 0) {
    try {
      await Promise.all(syncPromises)
      console.log('✅ All order-based sync updates completed successfully')
    } catch (error) {
      console.error('❌ Some order-based sync updates failed:', error)
      throw error
    }
  } */

  // Clear sync flags for products that were processed
  const productIds = productsNeedingSync.map((update) => update.productId)

  if (productIds.length > 0) {
    await prisma.products.updateMany({
      where: {
        productId: { in: productIds },
      },
      data: {
        needsSync: false,
        needsPromSync: false,
        needsRozetkaSync: false,
      },
    })

    console.log(
      `✅ Cleared sync flags for ${productIds.length} products after order sync`
    )
  }

  console.log(
    `🎉 Order-based marketplace synchronization completed for ${sourceMarketplace}`
  )
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
  await syncAfterOrder(
    [{ productId: '2737880255', orderedQuantity: 2 }],
    'prom'
  )
})() */
