// server/src/controllers/products/productController.ts
import { Request, Response } from 'express'
import productService, {
  type BatchProductUpdate,
  type ProductUpdateParams,
} from '../../services/products/productService'
import { ErrorFactory } from '../../middleware/errorHandler'
import {
  getProductsQuerySchema,
  createProductSchema,
  updateSingleProductSchema,
  updateBatchProductSchema,
} from '../../schemas/product.schema'

type TargetMarketplace = 'prom' | 'rozetka' | 'all'

const ALLOWED_TARGETS: TargetMarketplace[] = ['prom', 'rozetka', 'all']

export const getProducts = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { search } = getProductsQuerySchema.parse(req.query)
  const products = await productService.getProducts(search)

  res.json(products)
}

export const createProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  const validatedData = createProductSchema.parse(req.body)

  const product = await productService.createProduct(validatedData)

  res.status(201).json(product)
}

/* export const updateProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { productId } = req.params
  if (!productId) {
    throw ErrorFactory.validationError('productId is required in params')
  }

  const targetMarketplace = req.body.targetMarketplace as
    | TargetMarketplace
    | undefined

  if (
    targetMarketplace &&
    !ALLOWED_TARGETS.includes(targetMarketplace as TargetMarketplace)
  ) {
    throw ErrorFactory.validationError('Invalid target marketplace value')
  }

  const isBatchUpdate =
    productId === 'batch' && Array.isArray(req.body.products)

  if (isBatchUpdate) {
    await handleBatchUpdate(req, res, targetMarketplace)
  } else {
    await handleSingleUpdate(req, res, productId, targetMarketplace)
  }
}

const handleSingleUpdate = async (
  req: Request,
  res: Response,
  productId: string,
  targetMarketplace?: TargetMarketplace
) => {
  const updates: ProductUpdateParams = {}

  if (
    req.body.quantity !== undefined &&
    (typeof req.body.quantity !== 'number' || req.body.quantity < 0)
  ) {
    throw ErrorFactory.validationError('quantity must be a non-negative number')
  }

  if (
    req.body.price !== undefined &&
    (typeof req.body.price !== 'number' || req.body.price < 0)
  ) {
    throw ErrorFactory.validationError('price must be a non-negative number')
  }

  if (req.body.quantity !== undefined) updates.quantity = req.body.quantity
  if (req.body.price !== undefined) updates.price = req.body.price

  if (Object.keys(updates).length === 0) {
    throw ErrorFactory.validationError('No valid update parameters provided')
  }

  const result = await productService.updateSingleProduct({
    productId,
    updates,
    targetMarketplace,
  })

  const statusCode = result.success ? 200 : 207
  res.status(statusCode).json(result)
}

const handleBatchUpdate = async (
  req: Request,
  res: Response,
  targetMarketplace?: TargetMarketplace
) => {
  const { products }: { products: BatchProductUpdate[] } = req.body

  if (!Array.isArray(products) || products.length === 0) {
    throw ErrorFactory.validationError(
      'products array is required and must not be empty'
    )
  }

  const sanitizedProducts: BatchProductUpdate[] = products.map((item) => {
    if (
      !item.productId ||
      !item.updates ||
      Object.keys(item.updates).length === 0
    ) {
      throw ErrorFactory.validationError(
        'Each product must have productId and at least one update field'
      )
    }

    const { quantity, price } = item.updates

    if (
      quantity !== undefined &&
      (typeof quantity !== 'number' || quantity < 0)
    ) {
      throw ErrorFactory.validationError(
        `Product ${item.productId}: quantity must be a non-negative number`
      )
    }

    if (price !== undefined && (typeof price !== 'number' || price < 0)) {
      throw ErrorFactory.validationError(
        `Product ${item.productId}: price must be a non-negative number`
      )
    }

    const updates: ProductUpdateParams = {}
    if (quantity !== undefined) updates.quantity = quantity
    if (price !== undefined) updates.price = price

    return {
      productId: item.productId,
      updates,
    }
  })

  const result = await productService.updateBatchProducts({
    products: sanitizedProducts,
    targetMarketplace,
  })

  const statusCode = result.success ? 200 : 207
  res.status(statusCode).json(result)
} */

export const updateProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { productId } = req.params

  // Check if it's a batch update
  const isBatchUpdate =
    productId === 'batch' && Array.isArray(req.body.products)

  if (isBatchUpdate) {
    // === BATCH UPDATE LOGIC ===

    // 1. Validate everything with Zod. This throws an error if invalid.
    const { body } = updateBatchProductSchema.parse({ body: req.body })

    // 2. Call service with validated data
    const result = await productService.updateBatchProducts({
      products: body.products,
      targetMarketplace: body.targetMarketplace,
    })

    const statusCode = result.success ? 200 : 207
    res.status(statusCode).json(result)
  } else {
    // === SINGLE UPDATE LOGIC ===

    // 1. Validate params and body with Zod. Throws an error if invalid.
    const { params, body } = updateSingleProductSchema.parse({
      params: req.params,
      body: req.body,
    })

    // 2. Call service with validated data
    const result = await productService.updateSingleProduct({
      productId: params.productId,
      updates: {
        quantity: body.quantity,
        price: body.price,
      },
      targetMarketplace: body.targetMarketplace,
    })

    const statusCode = result.success ? 200 : 207
    res.status(statusCode).json(result)
  }
}

export const syncNewProductsFromMarketplaces = async (
  req: Request,
  res: Response
): Promise<void> => {
  const result = await productService.syncNewProductsFromMarketplaces()
  const statusCode = result.success ? 200 : 207
  res.status(statusCode).json(result)
}
