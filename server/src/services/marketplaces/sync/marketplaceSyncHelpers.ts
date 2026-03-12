// server/src/services/marketplaces/sync/marketplaceSyncHelpers.ts
import prisma from '../../../config/database'
import { fetchPromProducts } from '../../data-fetchers/fetchPromProducts'
import { fetchRozetkaProducts } from '../../data-fetchers/fetchRozetkaProducts'
import type {
  MarketplaceUpdateOptions,
  MarketplaceSyncStatus,
  MarketplaceUpdateResult,
} from '../../../types/marketplaces'
import { normalizeQuantity } from '../../../utils/helpers/normalizeQuantity'

/**
 * Initializes marketplace-specific quantity fields for products that have null values.
 * Fetches current data from Prom and Rozetka APIs and updates the database.
 *
 * @remarks
 * This should be run once during initial setup or migration to populate
 * promQuantity and rozetkaQuantity fields. It performs bulk updates using
 * Prisma transactions for efficiency.
 *
 * @example
 * // Run during application initialization or as a migration script
 * await initializeMarketplaceQuantitiesOptimized()
 */
export const initializeMarketplaceQuantitiesOptimized = async () => {
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
    (p) => p.promQuantity === null,
  )
  const needsRozetkaInit = productsToInitialize.filter(
    (p) => p.rozetkaQuantity === null,
  )

  // Process Prom products
  if (needsPromInit.length > 0) {
    try {
      console.log('🔄 Fetching ALL Prom products data...')
      const promProducts = await fetchPromProducts()
      const promProductsMap = new Map(
        promProducts.map((p) => [p.id.toString(), p]),
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
        }),
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
        rozetkaProducts.map((p) => [p.rz_item_id.toString(), p]),
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
        }),
      )
      console.log(`✅ Updated ${needsRozetkaInit.length} Rozetka quantities`)
    } catch (error) {
      console.error('❌ Error with Rozetka initialization:', error)
    }
  }

  console.log('✅ Marketplace quantities initialization completed')
}

/**
 * Updates the Rozetka product IDs in the app's database by fetching
 * current data from Rozetka and matching by SKU.
 *
 * @remarks
 * This function should be run periodically or when product mappings need
 * to be refreshed. It updates the externalIds.rozetka field for matching products.
 *
 * @throws {Error} If unable to fetch Rozetka products or update database
 *
 * @example
 * // Run as part of a sync job or migration
 * await syncRozetkaProductIds()
 */
export async function syncRozetkaProductIds() {
  try {
    const allRozetkaProducts = await fetchRozetkaProducts()

    console.log(
      `Found ${allRozetkaProducts.length} products on Rozetka. Starting sync...`,
    )
    let updatedCount = 0
    let notFoundCount = 0

    // Step 3: Iterate and update products in the database
    for (const rozetkaProduct of allRozetkaProducts) {
      const sku = rozetkaProduct.article

      if (!sku) {
        console.warn(
          `Skipping Rozetka product without an article/SKU: Name: ${rozetkaProduct.name}`,
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
            `Found ${existingProducts.length} products with the same SKU: ${sku}. Updating all of them.`,
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
            `Updated product with ID ${productToUpdate.productId} (SKU: ${sku}) with Rozetka data.`,
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
      `Successfully updated/processed ${updatedCount} product entries.`,
    )
    console.log(
      `${notFoundCount} SKUs from Rozetka were not found in the database.`,
    )
  } catch (error: any) {
    console.error('❌ Main sync process failed:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

/**
 * Creates a promise wrapper for marketplace update operations with consistent
 * error handling and result tracking. Supports both single and batch updates.
 *
 * @param options - Configuration for the marketplace update operation
 * @returns Promise that resolves when update completes (success or failure)
 *
 * @remarks
 * This function centralizes error handling for all marketplace updates.
 * Errors are caught and logged but don't throw to allow other updates to proceed.
 * Results are tracked in the provided arrays for later analysis.
 *
 * @example
 * const syncResults: string[] = []
 * const syncErrors: MarketplaceUpdateResult[] = []
 * const syncStatus = createMarketplaceSyncStatus()
 *
 * await createMarketplaceUpdatePromise({
 *   marketplaceName: 'Prom',
 *   productId: 'prod_123',
 *   updateFunction: () => updatePromProduct('123', { quantity: 10 }),
 *   onSuccess: () => syncStatus.promSynced = true,
 *   resultsArray: syncResults,
 *   errorsArray: syncErrors,
 *   isBatch: false
 * })
 */
export async function createMarketplaceUpdatePromise({
  marketplaceName,
  productId,
  count,
  updateFunction,
  onSuccess,
  resultsArray,
  errorsArray,
  isBatch = false,
}: MarketplaceUpdateOptions) {
  try {
    await updateFunction()
    resultsArray.push(marketplaceName)

    const message = isBatch
      ? `✅ Batch updated ${count} ${marketplaceName} products`
      : `✅ ${marketplaceName} product ${productId} updated successfully`
    console.log(message)

    if (onSuccess) onSuccess()
  } catch (error: any) {
    const isInactiveStoreError = error.message?.includes(
      'неактивним прайс-листом',
    )

    const errorResult: MarketplaceUpdateResult = {
      marketplace: marketplaceName,
      success: false,
      error: error.message || String(error),
    }
    errorsArray.push(errorResult)

    if (isInactiveStoreError) {
      console.warn(
        `⚠️ Rozetka store is inactive - skipping sync for product ${productId}`,
      )
    }
    const message = isBatch
      ? `❌ Failed to batch update ${marketplaceName} products`
      : `❌ Failed to update ${marketplaceName} product ${productId}`
    console.error(message, error)
  }
}

/**
 * Creates a new MarketplaceSyncStatus object with all flags set to false.
 * Use this to initialize sync tracking before performing marketplace updates.
 *
 * @returns A new sync status object with all flags set to false
 *
 * @remarks
 * This is a factory function to ensure consistent initialization.
 * Always use this instead of manually creating the object.
 *
 * @example
 * const syncStatus = createMarketplaceSyncStatus()
 * // syncStatus = { promSynced: false, rozetkaSynced: false }
 *
 * try {
 *   await updatePromProduct(productId, updates)
 *   syncStatus.promSynced = true
 * } catch (error) {
 *   // promSynced remains false
 * }
 *
 * // Use sync status to update database
 * if (syncStatus.promSynced) {
 *   await prisma.products.update({
 *     where: { productId },
 *     data: { lastPromSync: new Date() }
 *   })
 * }
 */
export function createMarketplaceSyncStatus(): MarketplaceSyncStatus {
  return { promSynced: false, rozetkaSynced: false }
}
