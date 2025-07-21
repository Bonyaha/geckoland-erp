import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { updateRozetkaQuantity } from '../services/marketplaces/rozetkaClient'
import { updatePromQuantity } from '../services/marketplaces/promClient'

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
    if (!productId || !name || price === undefined || stockQuantity === undefined) {
      res.status(400).json({ message: 'productId, name, price, and stockQuantity are required' });
      return;
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
    });
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Error creating product' });
  }
}

export const updateProductQuantity = async (req: Request, res: Response) => {
  const { productId, newQuantity } = req.body

  try {
    // Update app database
    const product = await prisma.products.update({
      where: { productId },
      data: {
        stockQuantity: newQuantity,
        needsSync: true,
        lastSynced: new Date(),
      },
    })

    // Handle external IDs safely with type checking
    const syncPromises: Promise<any>[] = []

    if (
      product.externalIds &&
      typeof product.externalIds === 'object' &&
      !Array.isArray(product.externalIds)
    ) {
      const externalIds = product.externalIds as Record<string, any>

      // Update Prom if ID exists
      if (externalIds.prom && typeof externalIds.prom === 'string') {
        syncPromises.push(
          updatePromQuantity(externalIds.prom, newQuantity).catch((error) => {
            console.error(
              `Failed to update Prom quantity for product ${productId}:`,
              error
            )
          })
        )
      }

      // Update Rozetka if ID exists
      if (
        externalIds.rozetka &&
        typeof externalIds.rozetka === 'object' &&
        externalIds.rozetka.item_id &&
        typeof externalIds.rozetka.item_id === 'string'
      ) {
        syncPromises.push(
          updateRozetkaQuantity(externalIds.rozetka.item_id, newQuantity).catch(
            (error) => {
              console.error(
                `Failed to update Rozetka quantity for product ${productId}:`,
                error
              )
              // Don't throw - continue with other updates
            }
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
      message: 'Quantity updated and synced successfully',
      syncedMarketplaces: syncPromises.length,
    })
  } catch (error) {
    console.error('Sync error:', error)
    res.status(500).json({ message: 'Failed to update quantity' })
  }
}