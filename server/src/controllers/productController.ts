import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { updateRozetkaProduct } from '../services/marketplaces/rozetkaClient'
import { updatePromProduct } from '../services/marketplaces/promClient'

const prisma = new PrismaClient()

export const getProducts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const search = req.query.search?.toString()
    const products = await prisma.products.findMany({
      where: {
        name: {
          contains: search,
        },
      },
    })
    res.json(products)
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving products' })
  }
}

export const createProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      productId,
      name,
      price,
      stockQuantity,
      sku,
      source = 'prom', // Default from schema
      externalIds = {}, // Default for Json field
      description,
      mainImage,
      images = [], // Default for String[] field
      inStock,
      available,
      priceOld,
      pricePromo,
      updatedPrice,
      currency,
      sellingType,
      presence,
      dateModified,
      lastSynced,
      needsSync = false, // Default from schema
      multilangData,
      categoryData,
      measureUnit,
      status,
    } = req.body

    // Validate required fields
    if (
      !productId ||
      !name ||
      price === undefined ||
      stockQuantity === undefined
    ) {
      res.status(400).json({
        message: 'productId, name, price, and stockQuantity are required',
      })
      return
    }

    const product = await prisma.products.create({
      data: {
        productId,
        name,
        price,
        stockQuantity,
        sku,
        source,
        externalIds,
        description,
        mainImage,
        images,
        inStock,
        available,
        priceOld,
        pricePromo,
        updatedPrice,
        currency,
        sellingType,
        presence,
        dateModified,
        lastSynced,
        needsSync,
        multilangData,
        categoryData,
        measureUnit,
        status,
      },
    })
    res.status(201).json(product)
  } catch (error) {
    res.status(500).json({ message: 'Error creating product' })
  }
}

interface ProductUpdateParams {
  quantity?: number
  price?: number
  // Add more fields as needed
}

//Function to update product in the app and immediately sync with marketplaces
export const updateProduct = async (req: Request, res: Response) => {
  const { productId } = req.params
  const updates: ProductUpdateParams = {}

  // Extract update parameters from request body
  if (req.body.quantity !== undefined) updates.quantity = req.body.quantity
  if (req.body.price !== undefined) updates.price = req.body.price

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ message: 'No valid update parameters provided' })
    return
  }

  try {
    // Prepare database update data
    const dbUpdateData: any = {
      needsSync: true,
      lastSynced: new Date(),
    }

    if (updates.quantity !== undefined)
      dbUpdateData.stockQuantity = updates.quantity
    if (updates.price !== undefined) dbUpdateData.price = updates.price

    console.log(`Updating product ${productId} with data:`, dbUpdateData)

    // Update app database
    const product = await prisma.products.update({
      where: { productId },
      data: dbUpdateData,
    })

    // Handle external marketplace updates
    const syncPromises: Promise<any>[] = []
    const syncResults: string[] = []

    // Helper function to handle marketplace sync with unified error handling and logging
    const createMarketplaceUpdatePromise = async (
      marketplaceName: string,
      productId: string,
      updateFunction: () => Promise<any>
    ) => {
      try {
        await updateFunction()
        syncResults.push(marketplaceName)
        console.log(
          `✅ ${marketplaceName} product ${productId} updated successfully`
        )
      } catch (error) {
        console.error(
          `Failed to update ${marketplaceName} product ${productId}:`,
          error
        )
      }
    }

    if (
      product.externalIds &&
      typeof product.externalIds === 'object' &&
      !Array.isArray(product.externalIds)
    ) {
      const externalIds = product.externalIds as Record<string, any>

      // Update Prom if ID exists
      if (externalIds.prom && typeof externalIds.prom === 'string') {
        const promUpdates: any = {}
        if (updates.quantity !== undefined)
          promUpdates.quantity = updates.quantity
        if (updates.price !== undefined) promUpdates.price = updates.price

        syncPromises.push(
          createMarketplaceUpdatePromise('Prom', productId, () =>
            updatePromProduct(externalIds.prom, promUpdates)
          )
        )
      }

      // Update Rozetka if ID exists
      if (
        externalIds.rozetka &&
        typeof externalIds.rozetka === 'object' &&
        externalIds.rozetka.item_id &&
        typeof externalIds.rozetka.item_id === 'string'
      ) {
        const rozetkaUpdates: any = {}
        if (updates.quantity !== undefined)
          rozetkaUpdates.quantity = updates.quantity
        if (updates.price !== undefined) rozetkaUpdates.price = updates.price

        syncPromises.push(
          createMarketplaceUpdatePromise('Rozetka', productId, () =>
            updateRozetkaProduct(externalIds.rozetka.item_id, rozetkaUpdates)
          )
        )
      }
    }

    // Execute all marketplace updates in parallel
    if (syncPromises.length > 0) {
      await Promise.allSettled(syncPromises)
    }

    // Mark sync complete
    await prisma.products.update({
      where: { productId },
      data: { needsSync: false },
    })

    res.json({
      message: 'Product updated and synced successfully',
      updates: updates,
      syncedMarketplaces: syncResults,
      totalMarketplaces: syncPromises.length,
    })
  } catch (error) {
    console.error('Product update error:', error)
    res.status(500).json({ message: 'Failed to update product' })
  }
}
