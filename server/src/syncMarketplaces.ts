//import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'
import { fetchPromProducts } from '../prisma/fetchPromProducts'
import { fetchChangedRozetkaProducts } from '../prisma/fetchRozetkaProducts'
import { updatePromProduct } from './services/marketplaces/promClient'
import { updateRozetkaProduct } from './services/marketplaces/rozetkaClient'

const prisma = new PrismaClient()

// Utility function to normalize quantity
// This ensures that null or undefined quantities are treated as 0
// It prevents issues when a product has null or undefined stock
// quantities, which could lead to incorrect updates or comparisons
const normalizeQuantity = (qty: number | null | undefined): number => qty ?? 0

const syncMarketplaces = async () => {
  // Fetch products from Prom
  const promProducts = await fetchPromProducts()
  console.log(`Fetched ${promProducts.length} Prom products`)

  // Track products that need updates
  const productUpdates = new Map<
    string,
    {
      productId: string
      promQuantity?: number
      rozetkaQuantity?: number
      minQuantity: number
      needsPromSync: boolean
      needsRozetkaSync: boolean
    }
  >()

  for (const promProduct of promProducts) {
    const appProduct = await prisma.products.findFirst({
      where: {
        externalIds: { path: ['prom'], equals: promProduct.id.toString() },
      },
    })

    /* if (appProduct && promProduct.id === 1727138638) {
      console.log('Found desired product')
      console.log(new Date(promProduct.date_modified))
      console.log('appProduct.lastSynced:', appProduct.lastSynced)

      console.log(
        appProduct.lastSynced !== null
          ? new Date(promProduct.date_modified) > appProduct.lastSynced
          : 'lastSynced is null'
      )
    } */
    if (
      appProduct &&
      normalizeQuantity(promProduct.quantity_in_stock) !==
        appProduct.stockQuantity
    ) {
      console.log('Found Prom product to sync:', appProduct.productId)
      console.log(
        `Prom product ${appProduct.productId} quantity changed from ${appProduct.stockQuantity} to ${promProduct.quantity_in_stock}`
      )

      const existing = productUpdates.get(appProduct.productId) || {
        productId: appProduct.productId,
        minQuantity: appProduct.stockQuantity,
        needsPromSync: false,
        needsRozetkaSync: false,
      }

      existing.promQuantity = promProduct.quantity_in_stock ?? 0
      existing.minQuantity = Math.min(
        existing.minQuantity,
        normalizeQuantity(existing.promQuantity)
      )
      existing.needsRozetkaSync = true // Need to sync Rozetka to match the new quantity

      console.log('existing object after Prom searching:', existing)

      productUpdates.set(appProduct.productId, existing)

      /* await prisma.products.update({
        where: { productId: appProduct.productId },
        data: {
          stockQuantity: promProduct.quantity_in_stock ?? 0,
          lastSynced: new Date(),
          needsSync: true,
        },
      }) */
    }
  }

  console.log(
    'Products to sync after Prom searching:',
    JSON.stringify(Array.from(productUpdates), null, 2)
  )

  /* ************************************************************** */
  //  Fetch products from Rozetka
  const rozetkaProducts = await fetchChangedRozetkaProducts()
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
    //console.log('Found appProduct:', appProduct);

    if (
      appProduct &&
      normalizeQuantity(rozetkaProduct.stock_quantity) !==
        appProduct.stockQuantity
    ) {
      console.log('Found Rozetka product to sync:', appProduct.productId)
      console.log(
        `Rozetka product ${appProduct.productId} quantity changed from ${appProduct.stockQuantity} to ${rozetkaProduct.stock_quantity}`
      )

      const existing = productUpdates.get(appProduct.productId) || {
        productId: appProduct.productId,
        minQuantity: appProduct.stockQuantity,
        needsPromSync: false,
        needsRozetkaSync: false,
      }

      existing.rozetkaQuantity = rozetkaProduct.stock_quantity

      console.log('existing object after Rozetka searching:', existing)
      // If we have both quantities, use the minimum (most restrictive)
      if (existing.promQuantity !== undefined) {
        console.log(
          `Both Prom and Rozetka quantities found for product ${appProduct.productId}`
        )

        existing.minQuantity = Math.min(
          existing.promQuantity,
          normalizeQuantity(existing.rozetkaQuantity)
        )
        existing.needsPromSync = existing.promQuantity > existing.minQuantity
        existing.needsRozetkaSync =
          normalizeQuantity(existing.rozetkaQuantity) > existing.minQuantity
      } else {
        console.log(
          'Only Rozetka quantity found for product',
          appProduct.productId
        )

        existing.minQuantity = Math.min(
          existing.minQuantity,
          normalizeQuantity(existing.rozetkaQuantity)
        )
        existing.needsPromSync = true // Need to sync Prom to match the new quantity
      }

      productUpdates.set(appProduct.productId, existing)

      /*  await prisma.products.update({
        where: { productId: appProduct.productId },
        data: {
          stockQuantity: rozetkaProduct.stock_quantity,
          lastSynced: new Date(),
          needsSync: true,
        },
      }) */
    }
  }

  console.log(
    'Products to sync after Rozetka searching:',
    JSON.stringify(Array.from(productUpdates), null, 2)
  )

  // Update app products with the calculated quantities
  for (const [productId, update] of productUpdates) {
    await prisma.products.update({
      where: { productId: productId },
      data: {
        stockQuantity: update.minQuantity,
        lastSynced: new Date(),
        needsSync: true,
      },
    })
  }

  // Sync products marked as needsSync

  console.log(`Found ${productUpdates.size} products that may be eligible for syncing`)

  for (const [productId, update] of productUpdates) {
    try {
      const product = await prisma.products.findUnique({
        where: { productId: productId },
      })

      if (!product) continue

      const syncPromises: Promise<any>[] = []

      // Type assertion for externalIds
      const externalIds = product.externalIds as {
        prom?: string
        rozetka?: {
          rz_item_id: string
          item_id: string
        }
      }

      // Only sync to Prom if needed and external ID exists
      if (update.needsPromSync && externalIds?.prom) {
        console.log(
          `Syncing product ${productId} to Prom with quantity ${update.minQuantity}`
        )
        /*  syncPromises.push(
          updatePromProduct(externalIds.prom, {
            quantity: update.minQuantity,
          })
        ) */
      }

      // Only sync to Rozetka if needed and external ID exists
      if (update.needsRozetkaSync && externalIds?.rozetka) {
        console.log(
          `Syncing product ${productId} to Rozetka with quantity ${update.minQuantity}`
        )
        /*  syncPromises.push(
          updateRozetkaProduct(externalIds.rozetka.item_id, {
            quantity: update.minQuantity,
          })
        ) */
      }

      /* if (syncPromises.length > 0) {
        await Promise.all(syncPromises)
      } */

      await prisma.products.update({
        where: { productId: productId },
        data: { needsSync: false },
      })
    } catch (error) {
      console.error(`Failed to sync product ${productId}:`, error)
    }
  }
}

// Run every 5 minutes
//cron.schedule('*/5 * * * *', syncMarketplaces)

// Add to end of index.ts
//console.log('Synchronization scheduled')
syncMarketplaces()
