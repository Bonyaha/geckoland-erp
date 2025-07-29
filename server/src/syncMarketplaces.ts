//import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'
import { fetchPromProducts } from '../prisma/fetchPromProducts' // Adjust path
import { fetchChangedRozetkaProducts } from '../prisma/fetchRozetkaProducts' // Adjust path
/* import {
  updatePromQuantity,
  updateRozetkaQuantity,
} from './services/marketplaceService' */

const prisma = new PrismaClient()

const normalizeQuantity = (qty: number | null | undefined): number => qty ?? 0

const syncMarketplaces = async () => {
  // Fetch products from Prom
  /* const promProducts = await fetchPromProducts()
  console.log(`Fetched ${promProducts.length} Prom products`)

  for (const promProduct of promProducts) {
    const appProduct = await prisma.products.findFirst({
      where: {
        externalIds: { path: ['prom'], equals: promProduct.id.toString() },
      },
    })
    if (appProduct && promProduct.id === 1919700674) {
      console.log('Found desired product')
      console.log(new Date(promProduct.date_modified))
      console.log('appProduct.lastSynced:', appProduct.lastSynced)

      console.log(
        appProduct.lastSynced !== null
          ? new Date(promProduct.date_modified) > appProduct.lastSynced
          : 'lastSynced is null'
      )
    }
    if (
      appProduct &&
      normalizeQuantity(promProduct.quantity_in_stock) !==
        appProduct.stockQuantity
    ) {
      console.log('Found Prom product to sync:', appProduct.productId)

      await prisma.products.update({
        where: { productId: appProduct.productId },
        data: {
          stockQuantity: promProduct.quantity_in_stock ?? 0,
          lastSynced: new Date(),
          needsSync: true,
        },
      })
    }
  } */

  //console.log('Products to sync:', productsToSync[0])

  // Fetch products from Rozetka
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

      //console.log('Found Rozetka product to sync:', appProduct.productId)
      await prisma.products.update({
        where: { productId: appProduct.productId },
        data: {
          stockQuantity: rozetkaProduct.stock_quantity,
          lastSynced: new Date(),
          needsSync: true,
        },
      })
    }
  }

  // Sync products marked as needsSync
  const productsToSync = await prisma.products.findMany({
    where: { needsSync: true },
  })
console.log(`Found ${productsToSync.length} products that need sync`);

  for (const product of productsToSync) {
    try {
      /*   await Promise.all([
        updatePromQuantity(product.externalIds.prom, product.stockQuantity),
        updateRozetkaQuantity(
          product.externalIds.rozetka,
          product.stockQuantity
        ),
      ]) */
      await prisma.products.update({
        where: { productId: product.productId },
        data: { needsSync: false },
      })
    } catch (error) {
      console.error(`Failed to sync product ${product.productId}:`, error)
    }
  }
}

// Run every 5 minutes
//cron.schedule('*/5 * * * *', syncMarketplaces)

// Add to end of index.ts
//console.log('Synchronization scheduled')
syncMarketplaces()
