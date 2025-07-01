import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

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
