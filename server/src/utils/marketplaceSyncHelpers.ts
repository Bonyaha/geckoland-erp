// server/src/utils/marketplaceSyncHelpers.ts
import { PrismaClient } from '@prisma/client'
import { fetchPromProducts } from '../../prisma/fetchPromProducts'
import { fetchRozetkaProducts } from '../../prisma/fetchRozetkaProducts'

const prisma = new PrismaClient()

// Utility function to normalize quantity
// This ensures that null or undefined quantities are treated as 0
// It prevents issues when a product has null or undefined stock
// quantities, which could lead to incorrect updates or comparisons
export const normalizeQuantity = (
  quantity: number | string | null | undefined
): number => {
  if (typeof quantity === 'string') {
    const parsed = parseInt(quantity, 10)
    return isNaN(parsed) || parsed < 0 ? 0 : parsed
  }
  if (typeof quantity === 'number') {
    return quantity < 0 ? 0 : quantity
  }
  return 0
}


// Utility function to replace null in promQuantity and rozetkaQuantity with numbers
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

//Function for updating products in app's database. It updates externalIds.rozetka fields
export async function syncRozetkaProductIds() {
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


type MarketplaceSyncStatus = {
  promSynced: boolean
  rozetkaSynced: boolean
}

interface MarketplaceUpdateOptions {
  marketplaceName: 'Prom' | 'Rozetka'
  productId?: string
  count?: number
  updateFunction: () => Promise<any>
  onSuccess?: () => void
  resultsArray: string[]
  errorsArray: Array<{ marketplace: string; error: string }>
  isBatch?: boolean
}

/**
 * Unified helper for both single and batch marketplace updates.
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
    errorsArray.push({
      marketplace: marketplaceName,
      error: error.message || String(error),
    })

    const message = isBatch
      ? `❌ Failed to batch update ${marketplaceName} products`
      : `❌ Failed to update ${marketplaceName} product ${productId}`
    console.error(message, error)
  }
}

export function createMarketplaceSyncStatus(): MarketplaceSyncStatus {
  return { promSynced: false, rozetkaSynced: false }
}
