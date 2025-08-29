//import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'
import { fetchCRMProducts } from '../prisma/fetchHPData'
import {
  fetchPromProductsWithTransformation,
  fetchPromProducts,
} from '../prisma/fetchPromProducts'
import { fetchRozetkaProducts } from '../prisma/fetchRozetkaProducts'
import { updatePromProduct } from './services/marketplaces/promClient'
import {
  updateMultipleRozetkaProducts,
  RozetkaUpdateParams,
} from './services/marketplaces/rozetkaClient'

const prisma = new PrismaClient()

// Updating quantities for all products in app's database
const updateAllMarketplaceQuantities = async () => {
  console.log('Updating all marketplace quantities for all products...')

  // First, fetch and sync Prom products as main source
  console.log('🔄 Fetching Prom products data...')
  const promProducts = await fetchPromProductsWithTransformation()
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

//Function for updating products in app's database. It updates externalIds.rozetka fields
async function syncRozetkaProductIds() {
  try {
    const allRozetkaProducts = await fetchRozetkaProducts()

    console.log(
      `Found ${allRozetkaProducts.length} products on Rozetka. Starting sync...`
    )
    let updatedCount = 0
    let notFoundCount = 0

    // Step 3: Iterate and update products in the database
    for (const rozetkaProduct of allRozetkaProducts) {
      const sku = rozetkaProduct.article

      if (!sku) {
        console.warn(
          `Skipping Rozetka product without an article/SKU: Name: ${rozetkaProduct.name}`
        )
        continue
      }

      if (!rozetkaProduct.rz_item_id || !rozetkaProduct.item_id) {
        console.warn(`Skipping SKU ${sku} due to missing Rozetka ID fields.`)
        continue
      }

      // Find ALL products in your database that match this SKU
      const existingProducts = await prisma.products.findMany({
        where: { sku: sku },
      })

      if (existingProducts.length > 0) {
        // This log will confirm it's finding the duplicates you saw in pgAdmin
        if (existingProducts.length > 1) {
          console.warn(
            `Found ${existingProducts.length} products with the same SKU: ${sku}. Updating all of them.`
          )
        }

        // Loop through each product found with that SKU
        for (const productToUpdate of existingProducts) {
          const currentExternalIds = (productToUpdate.externalIds as any) || {}

          const rozetkaData = {
            rz_item_id: String(rozetkaProduct.rz_item_id),
            item_id: String(rozetkaProduct.item_id),
          }

          const newExternalIds = {
            ...currentExternalIds,
            rozetka: rozetkaData,
          }

          // Update each product using its actual primary key, `productId`
          await prisma.products.update({
            where: { productId: productToUpdate.productId }, // Use the guaranteed unique @id field
            data: {
              externalIds: newExternalIds,
            },
          })

          updatedCount++
          console.log(
            `Updated product with ID ${productToUpdate.productId} (SKU: ${sku}) with Rozetka data.`
          )
        }
      } else {
        // Product with this SKU was not found in your database
        notFoundCount++
        console.warn(`SKU ${sku} from Rozetka not found in the local database.`)
      }
    }

    console.log('--- Sync Complete ---')
    console.log(
      `Successfully updated/processed ${updatedCount} product entries.`
    )
    console.log(
      `${notFoundCount} SKUs from Rozetka were not found in the database.`
    )
  } catch (error: any) {
    console.error('❌ Main sync process failed:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Utility function to replace null in promQuantity and rozetkaQuantity with numbers
const initializeMarketplaceQuantitiesOptimized = async () => {
  console.log('Initializing marketplace quantities for existing products...')

  // Get all products that need initialization
  const productsToInitialize = await prisma.products.findMany({
    where: {
      OR: [{ promQuantity: null }, { rozetkaQuantity: null }],
    },
  })

  console.log(`Found ${productsToInitialize.length} products to initialize`)

  // Separate products by marketplace
  const needsPromInit = productsToInitialize.filter(
    (p) => p.promQuantity === null
  )
  const needsRozetkaInit = productsToInitialize.filter(
    (p) => p.rozetkaQuantity === null
  )

  // Process Prom products
  if (needsPromInit.length > 0) {
    try {
      console.log('🔄 Fetching ALL Prom products data...')
      const promProducts = await fetchPromProducts()
      const promProductsMap = new Map(
        promProducts.map((p) => [p.id.toString(), p])
      )

      // Use Prisma transaction for bulk updates
      await prisma.$transaction(
        needsPromInit.map((product) => {
          const externalIds = product.externalIds as { prom?: string }
          const promProduct = externalIds?.prom
            ? promProductsMap.get(externalIds.prom)
            : null
          const quantity = promProduct
            ? normalizeQuantity(promProduct.quantity_in_stock)
            : product.stockQuantity

          return prisma.products.update({
            where: { productId: product.productId },
            data: {
              promQuantity: quantity,
              lastPromSync: new Date(),
            },
          })
        })
      )
      console.log(`✅ Updated ${needsPromInit.length} Prom quantities`)
    } catch (error) {
      console.error('❌ Error with Prom initialization:', error)
    }
  }

  // Process Rozetka products
  if (needsRozetkaInit.length > 0) {
    try {
      console.log('🔄 Fetching ALL Rozetka products data...')
      const rozetkaProducts = await fetchRozetkaProducts()
      const rozetkaProductsMap = new Map(
        rozetkaProducts.map((p) => [p.rz_item_id.toString(), p])
      )

      // Use Prisma transaction for bulk updates
      await prisma.$transaction(
        needsRozetkaInit.map((product) => {
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
      console.log(`✅ Updated ${needsRozetkaInit.length} Rozetka quantities`)
    } catch (error) {
      console.error('❌ Error with Rozetka initialization:', error)
    }
  }

  console.log('✅ Marketplace quantities initialization completed')
}

// Utility function to normalize quantity
// This ensures that null or undefined quantities are treated as 0
// It prevents issues when a product has null or undefined stock
// quantities, which could lead to incorrect updates or comparisons
const normalizeQuantity = (qty: number | null | undefined): number => qty ?? 0

// Main function to sync marketplaces
// This will be called periodically to keep marketplace data in sync
/* const syncMarketplaces = async () => {
  // Fetch products from Prom
  const promProducts = await fetchPromProducts()
  console.log(`Fetched ${promProducts.length} Prom products`)

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
      masterQuantityDelta: number
      syncStrategy: 'same_quantity' | 'different_quantity'
    }
  >()

  // Process Prom products
  for (const promProduct of promProducts) {
    const appProduct = await prisma.products.findFirst({
      where: {
        externalIds: { path: ['prom'], equals: promProduct.id.toString() },
      },
    })

    if (appProduct) {
      const externalIds = appProduct.externalIds as {
        prom?: string
        rozetka?: {
          rz_item_id: string
          item_id: string
        }
      }

      const currentPromQuantity = normalizeQuantity(
        promProduct.quantity_in_stock
      )
      const lastKnownPromQuantity =
        appProduct.promQuantity ?? appProduct.stockQuantity

      // Calculate delta - how much the quantity changed on Prom
      const promDelta = currentPromQuantity - lastKnownPromQuantity

      if (promDelta !== 0) {
        console.log(
          `Prom product ${appProduct.productId} quantity changed by ${promDelta}`
        )
        console.log(
          `  From: ${lastKnownPromQuantity} To: ${currentPromQuantity}`
        )

        const update = productsToUpdate.get(appProduct.productId) || {
          productId: appProduct.productId,
          needsPromSync: false,
          needsRozetkaSync: false,
          masterQuantityDelta: 0,
          syncStrategy: 'same_quantity', // default strategy
        }

        update.promQuantityDelta = promDelta
        update.newPromQuantity = currentPromQuantity
        update.masterQuantityDelta += promDelta

        // Determine sync strategy based on current quantities
        const currentRozetkaQuantity =
          appProduct.rozetkaQuantity ?? appProduct.stockQuantity
        if (lastKnownPromQuantity === currentRozetkaQuantity) {
          update.syncStrategy = 'same_quantity'
        } else {
          update.syncStrategy = 'different_quantity'
        }

        // If Prom quantity changed, we need to sync this change to other marketplaces
        if (externalIds?.rozetka) {
          update.needsRozetkaSync = true
        }

        productsToUpdate.set(appProduct.productId, update)
      }
    }
  }

  console.log(
    'Products to update after Prom processing:',
    JSON.stringify(Array.from(productsToUpdate), null, 2)
  )

  // Process Rozetka products
  const rozetkaProducts = await fetchRozetkaProducts()
  console.log(`Fetched ${rozetkaProducts.length} Rozetka products`)

  for (const rozetkaProduct of rozetkaProducts) {
    const appProduct = await prisma.products.findFirst({
      where: {
        externalIds: {
          path: ['rozetka', 'rz_item_id'],
          equals: rozetkaProduct.rz_item_id.toString(),
        },
      },
    })

    if (appProduct) {
      const externalIds = appProduct.externalIds as {
        prom?: string
        rozetka?: {
          rz_item_id: string
          item_id: string
        }
      }

      const currentRozetkaQuantity = normalizeQuantity(
        rozetkaProduct.stock_quantity
      )
      const lastKnownRozetkaQuantity =
        appProduct.rozetkaQuantity ?? appProduct.stockQuantity

      // Calculate delta - how much the quantity changed on Rozetka
      const rozetkaDelta = currentRozetkaQuantity - lastKnownRozetkaQuantity

      if (rozetkaDelta !== 0) {
        console.log(
          `Rozetka product ${appProduct.productId} quantity changed by ${rozetkaDelta}`
        )
        console.log(
          `  From: ${lastKnownRozetkaQuantity} To: ${currentRozetkaQuantity}`
        )

        const update = productsToUpdate.get(appProduct.productId) || {
          productId: appProduct.productId,
          needsPromSync: false,
          needsRozetkaSync: false,
          masterQuantityDelta: 0,
          syncStrategy: 'same_quantity',
        }

        update.rozetkaQuantityDelta = rozetkaDelta
        update.newRozetkaQuantity = currentRozetkaQuantity
        update.masterQuantityDelta += rozetkaDelta

        // Determine sync strategy based on current quantities
        const currentPromQuantity =
          appProduct.promQuantity ?? appProduct.stockQuantity
        if (lastKnownRozetkaQuantity === currentPromQuantity) {
          update.syncStrategy = 'same_quantity'
        } else {
          update.syncStrategy = 'different_quantity'
        }

        // If Rozetka quantity changed, we need to sync this change to other marketplaces
        if (externalIds?.prom) {
          update.needsPromSync = true
        }

        productsToUpdate.set(appProduct.productId, update)
      }
    }
  }

  console.log(
    'Products to update after Rozetka processing:',
    JSON.stringify(Array.from(productsToUpdate), null, 2)
  )

  // Calculate new quantities for syncing - THIS IS THE KEY LOGIC FIX
  for (const [productId, update] of productsToUpdate) {
    const appProduct = await prisma.products.findUnique({
      where: { productId: productId },
    })

    if (!appProduct) continue

    console.log(
      `Processing sync strategy for product ${productId}: ${update.syncStrategy}`
    )

    if (update.syncStrategy === 'same_quantity') {
      // SAME QUANTITY STRATEGY: Both marketplaces should have the same final quantity
      // Calculate the new master quantity after all changes
      const newMasterQuantity = Math.max(
        0,
        appProduct.stockQuantity + update.masterQuantityDelta
      )

      console.log(
        `Same quantity strategy: Master quantity ${appProduct.stockQuantity} + ${update.masterQuantityDelta} = ${newMasterQuantity}`
      )

      // Both marketplaces should sync to the new master quantity
      if (update.promQuantityDelta !== undefined) {
        update.newPromQuantity =
          appProduct.promQuantity! + update.promQuantityDelta
        update.needsRozetkaSync = true
        update.newRozetkaQuantity = newMasterQuantity // Sync Rozetka to master
      }

      if (update.rozetkaQuantityDelta !== undefined) {
        update.newRozetkaQuantity =
          appProduct.rozetkaQuantity! + update.rozetkaQuantityDelta
        update.needsPromSync = true
        update.newPromQuantity = newMasterQuantity // Sync Prom to master
      }

      // If both changed, both should be set to the new master quantity
      if (
        update.promQuantityDelta !== undefined &&
        update.rozetkaQuantityDelta !== undefined
      ) {
        console.log(
          `Both marketplaces changed - syncing both to master quantity: ${newMasterQuantity}`
        )
        update.newPromQuantity = newMasterQuantity
        update.newRozetkaQuantity = newMasterQuantity
        update.needsPromSync = true
        update.needsRozetkaSync = true
      }
    } else {
      // DIFFERENT QUANTITY STRATEGY: Apply deltas proportionally
      if (
        update.promQuantityDelta !== undefined &&
        update.rozetkaQuantityDelta === undefined
      ) {
        // Only Prom changed, apply same delta to Rozetka
        const currentRozetkaQuantity =
          appProduct.rozetkaQuantity ?? appProduct.stockQuantity
        update.newRozetkaQuantity = Math.max(
          0,
          currentRozetkaQuantity + update.promQuantityDelta
        )
        console.log(
          `Different quantities - Prom changed by ${update.promQuantityDelta}, updating Rozetka: ${currentRozetkaQuantity} → ${update.newRozetkaQuantity}`
        )
      }

      if (
        update.rozetkaQuantityDelta !== undefined &&
        update.promQuantityDelta === undefined
      ) {
        // Only Rozetka changed, apply same delta to Prom
        const currentPromQuantity =
          appProduct.promQuantity ?? appProduct.stockQuantity
        update.newPromQuantity = Math.max(
          0,
          currentPromQuantity + update.rozetkaQuantityDelta
        )
        console.log(
          `Different quantities - Rozetka changed by ${update.rozetkaQuantityDelta}, updating Prom: ${currentPromQuantity} → ${update.newPromQuantity}`
        )
      }

      if (
        update.promQuantityDelta !== undefined &&
        update.rozetkaQuantityDelta !== undefined
      ) {
        // Both changed - keep individual changes, apply combined delta to maintain proportions
        console.log(
          `Different quantities - both changed, keeping individual quantities`
        )
        // Quantities are already set correctly in newPromQuantity and newRozetkaQuantity
        update.needsPromSync = false
        update.needsRozetkaSync = false
      }
    }
  }

  // Update database with new quantities
  for (const [productId, update] of productsToUpdate) {
    const appProduct = await prisma.products.findUnique({
      where: { productId: productId },
    })

    if (!appProduct) continue

    const newMasterQuantity = Math.max(
      0,
      appProduct.stockQuantity + update.masterQuantityDelta
    )

    const updateData: any = {
      stockQuantity: newMasterQuantity,
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

  // Perform marketplace syncing
  const productsNeedingSync = await prisma.products.findMany({
    where: {
      OR: [{ needsPromSync: true }, { needsRozetkaSync: true }],
    },
  })

  console.log(
    `Found ${productsNeedingSync.length} products needing marketplace sync`
  )

  for (const product of productsNeedingSync) {
    try {
      const syncPromises: Promise<any>[] = []

      // Type assertion for externalIds
      const externalIds = product.externalIds as {
        prom?: string
        rozetka?: {
          rz_item_id: string
          item_id: string
        }
      }

      // Sync to Prom if needed
      if (
        product.needsPromSync &&
        externalIds?.prom &&
        product.promQuantity !== null
      ) {
        console.log(
          `Syncing product ${product.productId} to Prom with quantity ${product.promQuantity}`
        )
        syncPromises.push(
          updatePromProduct(externalIds.prom, {
            quantity: product.promQuantity,
          })
        )
      }

      // Sync to Rozetka if needed
      if (
        product.needsRozetkaSync &&
        externalIds?.rozetka &&
        product.rozetkaQuantity !== null
      ) {
        console.log(
          `Syncing product ${product.productId} to Rozetka with quantity ${product.rozetkaQuantity}`
        )
        syncPromises.push(
          updateRozetkaProduct(externalIds.rozetka.item_id, {
            quantity: product.rozetkaQuantity,
          })
        )
      }

      if (syncPromises.length > 0) {
        await Promise.all(syncPromises)
      }

      // Clear sync flags
      await prisma.products.update({
        where: { productId: product.productId },
        data: {
          needsSync: false,
          needsPromSync: false,
          needsRozetkaSync: false,
        },
      })

      console.log(`✅ Successfully synced product ${product.productId}`)
    } catch (error) {
      console.error(`❌ Failed to sync product ${product.productId}:`, error)
    }
  }

  console.log('Marketplace synchronization completed')
} */

const syncMarketplaces = async () => {
  // Fetch products from Prom
  const promProducts = await fetchPromProducts()
  console.log(`Fetched ${promProducts.length} Prom products`)

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
      masterQuantityDelta: number
      syncStrategy: 'same_quantity' | 'different_quantity'
    }
  >()

  // Process Prom products
  for (const promProduct of promProducts) {
    const appProduct = await prisma.products.findFirst({
      where: {
        externalIds: { path: ['prom'], equals: promProduct.id.toString() },
      },
    })

    if (appProduct) {
      const externalIds = appProduct.externalIds as {
        prom?: string
        rozetka?: {
          rz_item_id: string
          item_id: string
        }
      }

      const currentPromQuantity = normalizeQuantity(
        promProduct.quantity_in_stock
      )
      const lastKnownPromQuantity =
        appProduct.promQuantity ?? appProduct.stockQuantity

      // Calculate delta - how much the quantity changed on Prom
      const promDelta = currentPromQuantity - lastKnownPromQuantity

      if (promDelta !== 0) {
        console.log(
          `Prom product ${appProduct.productId} quantity changed by ${promDelta}`
        )
        console.log(
          `  From: ${lastKnownPromQuantity} To: ${currentPromQuantity}`
        )

        const update = productsToUpdate.get(appProduct.productId) || {
          productId: appProduct.productId,
          needsPromSync: false,
          needsRozetkaSync: false,
          masterQuantityDelta: 0,
          syncStrategy: 'same_quantity', // default strategy
        }

        update.promQuantityDelta = promDelta
        update.newPromQuantity = currentPromQuantity
        update.masterQuantityDelta += promDelta

        // Determine sync strategy based on current quantities
        const currentRozetkaQuantity =
          appProduct.rozetkaQuantity ?? appProduct.stockQuantity
        if (lastKnownPromQuantity === currentRozetkaQuantity) {
          update.syncStrategy = 'same_quantity'
        } else {
          update.syncStrategy = 'different_quantity'
        }

        // For different_quantity strategy, don't sync to other marketplaces unless both changed
        if (update.syncStrategy === 'same_quantity' && externalIds?.rozetka) {
          update.needsRozetkaSync = true
        }

        productsToUpdate.set(appProduct.productId, update)
      }
    }
  }

  console.log(
    'Products to update after Prom processing:',
    JSON.stringify(Array.from(productsToUpdate), null, 2)
  )

  // Process Rozetka products
  const rozetkaProducts = await fetchRozetkaProducts()
  console.log(`Fetched ${rozetkaProducts.length} Rozetka products`)

  for (const rozetkaProduct of rozetkaProducts) {
    const appProduct = await prisma.products.findFirst({
      where: {
        externalIds: {
          path: ['rozetka', 'rz_item_id'],
          equals: rozetkaProduct.rz_item_id.toString(),
        },
      },
    })

    if (appProduct) {
      const externalIds = appProduct.externalIds as {
        prom?: string
        rozetka?: {
          rz_item_id: string
          item_id: string
        }
      }

      const currentRozetkaQuantity = normalizeQuantity(
        rozetkaProduct.stock_quantity
      )
      const lastKnownRozetkaQuantity =
        appProduct.rozetkaQuantity ?? appProduct.stockQuantity

      // Calculate delta - how much the quantity changed on Rozetka
      const rozetkaDelta = currentRozetkaQuantity - lastKnownRozetkaQuantity

      if (rozetkaDelta !== 0) {
        console.log(
          `Rozetka product ${appProduct.productId} quantity changed by ${rozetkaDelta}`
        )
        console.log(
          `  From: ${lastKnownRozetkaQuantity} To: ${currentRozetkaQuantity}`
        )

        const update = productsToUpdate.get(appProduct.productId) || {
          productId: appProduct.productId,
          needsPromSync: false,
          needsRozetkaSync: false,
          masterQuantityDelta: 0,
          syncStrategy: 'same_quantity',
        }

        update.rozetkaQuantityDelta = rozetkaDelta
        update.newRozetkaQuantity = currentRozetkaQuantity
        update.masterQuantityDelta += rozetkaDelta

        // Determine sync strategy based on current quantities
        const currentPromQuantity =
          appProduct.promQuantity ?? appProduct.stockQuantity
        if (lastKnownRozetkaQuantity === currentPromQuantity) {
          update.syncStrategy = 'same_quantity'
        } else {
          update.syncStrategy = 'different_quantity'
        }

        // For different_quantity strategy, don't sync to other marketplaces unless both changed
        if (update.syncStrategy === 'same_quantity' && externalIds?.prom) {
          update.needsPromSync = true
        }

        productsToUpdate.set(appProduct.productId, update)
      }
    }
  }

  console.log(
    'Products to update after Rozetka processing:',
    JSON.stringify(Array.from(productsToUpdate), null, 2)
  )

  // Calculate new quantities for syncing - MODIFIED LOGIC
  for (const [productId, update] of productsToUpdate) {
    const appProduct = await prisma.products.findUnique({
      where: { productId: productId },
    })

    if (!appProduct) continue

    console.log(
      `Processing sync strategy for product ${productId}: ${update.syncStrategy}`
    )

    if (update.syncStrategy === 'same_quantity') {
      // SAME QUANTITY STRATEGY: Both marketplaces should have the same final quantity
      // Calculate the new master quantity after all changes
      const newMasterQuantity = Math.max(
        0,
        appProduct.stockQuantity + update.masterQuantityDelta
      )

      console.log(
        `Same quantity strategy: Master quantity ${appProduct.stockQuantity} + ${update.masterQuantityDelta} = ${newMasterQuantity}`
      )

      // Both marketplaces should sync to the new master quantity
      if (update.promQuantityDelta !== undefined) {
        update.newPromQuantity =
          appProduct.promQuantity! + update.promQuantityDelta
        update.needsRozetkaSync = true
        update.newRozetkaQuantity = newMasterQuantity // Sync Rozetka to master
      }

      if (update.rozetkaQuantityDelta !== undefined) {
        update.newRozetkaQuantity =
          appProduct.rozetkaQuantity! + update.rozetkaQuantityDelta
        update.needsPromSync = true
        update.newPromQuantity = newMasterQuantity // Sync Prom to master
      }

      // If both changed, both should be set to the new master quantity
      if (
        update.promQuantityDelta !== undefined &&
        update.rozetkaQuantityDelta !== undefined
      ) {
        console.log(
          `Both marketplaces changed - syncing both to master quantity: ${newMasterQuantity}`
        )
        update.newPromQuantity = newMasterQuantity
        update.newRozetkaQuantity = newMasterQuantity
        update.needsPromSync = true
        update.needsRozetkaSync = true
      }
    } else {
      // DIFFERENT QUANTITY STRATEGY: Only update the marketplace that changed, leave others unchanged
      if (
        update.promQuantityDelta !== undefined &&
        update.rozetkaQuantityDelta === undefined
      ) {
        // Only Prom changed, keep Rozetka unchanged
        const currentRozetkaQuantity =
          appProduct.rozetkaQuantity ?? appProduct.stockQuantity
        update.newRozetkaQuantity = currentRozetkaQuantity // Keep current Rozetka quantity
        update.needsRozetkaSync = false // Don't sync to Rozetka

        console.log(
          `Different quantities - Only Prom changed by ${update.promQuantityDelta}, keeping Rozetka unchanged at ${currentRozetkaQuantity}`
        )
      }

      if (
        update.rozetkaQuantityDelta !== undefined &&
        update.promQuantityDelta === undefined
      ) {
        // Only Rozetka changed, keep Prom unchanged
        const currentPromQuantity =
          appProduct.promQuantity ?? appProduct.stockQuantity
        update.newPromQuantity = currentPromQuantity // Keep current Prom quantity
        update.needsPromSync = false // Don't sync to Prom

        console.log(
          `Different quantities - Only Rozetka changed by ${update.rozetkaQuantityDelta}, keeping Prom unchanged at ${currentPromQuantity}`
        )
      }

      if (
        update.promQuantityDelta !== undefined &&
        update.rozetkaQuantityDelta !== undefined
      ) {
        // Both changed - keep individual changes, no cross-marketplace sync needed
        console.log(
          `Different quantities - both changed, keeping individual quantities`
        )
        // Quantities are already set correctly in newPromQuantity and newRozetkaQuantity
        update.needsPromSync = false
        update.needsRozetkaSync = false
      }
    }
  }

  // Update database with new quantities
  for (const [productId, update] of productsToUpdate) {
    const appProduct = await prisma.products.findUnique({
      where: { productId: productId },
    })

    if (!appProduct) continue

    const newMasterQuantity = Math.max(
      0,
      appProduct.stockQuantity + update.masterQuantityDelta
    )

    const updateData: any = {
      stockQuantity: newMasterQuantity,
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

  // Perform marketplace syncing
  const productsNeedingSync = await prisma.products.findMany({
    where: {
      OR: [{ needsPromSync: true }, { needsRozetkaSync: true }],
    },
  })

  console.log(
    `Found ${productsNeedingSync.length} products needing marketplace sync`
  )

  // Prepare batch updates
  const promUpdates: Array<{ productId: string; quantity: number }> = []
  const rozetkaUpdates: Array<{
    productId: string
    updates: RozetkaUpdateParams
  }> = []

  for (const product of productsNeedingSync) {
    // Type assertion for externalIds
    const externalIds = product.externalIds as {
      prom?: string
      rozetka?: {
        rz_item_id: string
        item_id: string
      }
    }

    // Collect Prom updates
    if (
      product.needsPromSync &&
      externalIds?.prom &&
      product.promQuantity !== null
    ) {
      console.log(
        `Preparing Prom sync for product ${product.productId} with quantity ${product.promQuantity}`
      )
      promUpdates.push({
        productId: externalIds.prom,
        quantity: product.promQuantity,
      })
    }

    // Collect Rozetka updates
    if (
      product.needsRozetkaSync &&
      externalIds?.rozetka &&
      product.rozetkaQuantity !== null
    ) {
      console.log(
        `Preparing Rozetka sync for product ${product.productId} with quantity ${product.rozetkaQuantity}`
      )
      rozetkaUpdates.push({
        productId: externalIds.rozetka.item_id,
        updates: { quantity: product.rozetkaQuantity },
      })
    }
  }

  // Execute batch updates
  const syncPromises: Promise<any>[] = []

  if (promUpdates.length > 0) {
    console.log(`🚀 Batch updating ${promUpdates.length} Prom products`)
    // If you have updateMultiplePromProducts, use it here
    // syncPromises.push(updateMultiplePromProducts(promUpdates))

    // Otherwise, use individual updates (you might want to batch these too)
    for (const { productId, quantity } of promUpdates) {
      syncPromises.push(updatePromProduct(productId, { quantity }))
    }
  }

  // Batch update Rozetka products
  if (rozetkaUpdates.length > 0) {
    console.log(`🚀 Batch updating ${rozetkaUpdates.length} Rozetka products`)
    syncPromises.push(updateMultipleRozetkaProducts(rozetkaUpdates))
  }

  // Execute all updates
  if (syncPromises.length > 0) {
    try {
      await Promise.all(syncPromises)
      console.log('✅ All batch updates completed successfully')
    } catch (error) {
      console.error('❌ Some batch updates failed:', error)
      throw error
    }
  }

  // Clear sync flags for all products that were processed
  if (productsNeedingSync.length > 0) {
    const productIds = productsNeedingSync.map((p) => p.productId)

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

    console.log(`✅ Cleared sync flags for ${productIds.length} products`)
  }

  console.log('Marketplace synchronization completed')
}

// Run every 5 minutes
//cron.schedule('*/5 * * * *', syncMarketplaces)

// Add to end of index.ts
//console.log('Synchronization scheduled')
//initializeMarketplaceQuantitiesOptimized()
//syncMarketplaces()
//syncRozetkaProductIds()
updateAllMarketplaceQuantities()
