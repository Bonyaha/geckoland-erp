// server/src/controllers/products/productController.ts
import { Request, Response } from 'express'
import productService from '../../services/products/productService'
import { BatchUpdateInput } from '../../types/marketplaces'
import {
  ProductQueryParams,
  ProductCreateInput,
  SingleProductUpdateInput,
  SingleProductUpdateResult,
  BatchProductUpdateInput,
  BatchProductUpdateResult,
  ProductSyncResult,
} from '../../types/products'

/**
 * Get products with optional search filtering
 * @route GET /api/products
 */
export const getProducts = async (
  req: Request,
  res: Response
): Promise<void> => {
  const queryParams = {
    search: req.query.search as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    stockFilter: req.query.stockFilter as
      | 'all'
      | 'inStock'
      | 'outOfStock'
      | undefined,
  }
  const result = await productService.getProducts(queryParams)
  // Convert Decimal to number for JSON serialization
  const formattedProducts = result.products.map((product) => ({
    ...product,
    price: parseFloat(product.price.toString()),
    priceOld: product.priceOld ? parseFloat(product.priceOld.toString()) : null,
    pricePromo: product.pricePromo
      ? parseFloat(product.pricePromo.toString())
      : null,
    updatedPrice: product.updatedPrice
      ? parseFloat(product.updatedPrice.toString())
      : null,
    costPrice: product.costPrice
      ? parseFloat(product.costPrice.toString())
      : null,
  }))

   res.json({
     products: formattedProducts,
     pagination: result.pagination,
   })
}

/**
 * Create a new product
 * @route POST /api/products
 */
export const createProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  const productData: ProductCreateInput = req.body
  const product = await productService.createProduct(productData)

  res.status(201).json(product)
}

/**
 * Update multiple products in batch
 * @route PATCH /api/products/batch
 */
export const updateBatchProducts = async (
  req: Request,
  res: Response
): Promise<void> => {
  // Middleware guarantees req.body matches updateBatchProductSchema
  // validation.ts ensures req.body matches the schema
  // We cast it to our strict type for IntelliSense
  const input: BatchProductUpdateInput = {
    products: req.body.products,
    targetMarketplace: req.body.targetMarketplace,
  }

  const result: BatchProductUpdateResult =
    await productService.updateBatchProducts(input)

  const statusCode = result.success ? 200 : 207
  res.status(statusCode).json(result)
}

/**
 * Update a single product
 * @route PATCH /api/products/:productId
 */
export const updateSingleProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  // Middleware guarantees req.params and req.body match updateSingleProductSchema
  const { productId } = req.params
  const { quantity, price, targetMarketplace } = req.body

  const input: SingleProductUpdateInput = {
    productId,
    updates: {
      quantity,
      price,
    },
    targetMarketplace,
  }
  const result: SingleProductUpdateResult =
    await productService.updateSingleProduct(input)

  const statusCode = result.success ? 200 : 207
  res.status(statusCode).json(result)
}

/**
 * Sync new products from marketplaces
 * @route POST /api/products/sync/marketplaces
 */
export const syncNewProductsFromMarketplaces = async (
  req: Request,
  res: Response
): Promise<void> => {
  // No validation needed (no input parameters)
  const result: ProductSyncResult =
    await productService.syncNewProductsFromMarketplaces()

  const statusCode = result.success ? 200 : 207
  res.status(statusCode).json(result)
}
