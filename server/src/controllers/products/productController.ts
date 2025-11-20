// server/src/controllers/products/productController.ts
import { Request, Response } from 'express'
import productService from '../../services/products/productService'
import { BatchUpdateInput } from '../../types/marketplaces'

export const getProducts = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { search } = req.query as { search?: string }
  const products = await productService.getProducts(search)

  res.json(products)
}

export const createProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  const product = await productService.createProduct(req.body)

  res.status(201).json(product)
}
  

export const updateBatchProducts = async (
  req: Request,
  res: Response
): Promise<void> => {
  // Middleware guarantees req.body matches updateBatchProductSchema
  // validation.ts ensures req.body matches the schema
  // We cast it to our strict type for IntelliSense
  const input = req.body as BatchUpdateInput

  const result = await productService.updateBatchProducts(input)

  const statusCode = result.success ? 200 : 207
  res.status(statusCode).json(result)
}

export const updateSingleProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  // Middleware guarantees req.params and req.body match updateSingleProductSchema
  const { productId } = req.params
  const { quantity, price, targetMarketplace } = req.body

  const result = await productService.updateSingleProduct({
    productId,
    updates: {
      quantity,
      price,
    },
    targetMarketplace,
  })

  const statusCode = result.success ? 200 : 207
  res.status(statusCode).json(result)
}

export const syncNewProductsFromMarketplaces = async (
  req: Request,
  res: Response
): Promise<void> => {
  // No validation needed (no input parameters)
  const result = await productService.syncNewProductsFromMarketplaces()

  const statusCode = result.success ? 200 : 207
  res.status(statusCode).json(result)
}
