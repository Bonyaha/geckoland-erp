// server/src/controllers/products/productController.ts
import { Request, Response } from 'express'
import prisma from '../../config/database'
import productService from '../../services/products/productService'
import {
  BatchUpdateInput,
  ProductExternalIds,
  KnownMarketplace,
} from '../../types/marketplaces'
import { MARKETPLACE_REGISTRY } from '../../services/marketplaces/sync/marketplaceSyncHelpers'
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
 * Get product inventory statistics
 * @route GET /api/products/stats
 */
export const getProductStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  const stats = await productService.getProductStats()
  res.json(stats)
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
  const { productId } = req.params as { productId: string }
  const { quantity, price, costPrice, targetMarketplace } = req.body

  const input: SingleProductUpdateInput = {
    productId,
    updates: {
      quantity,
      price,
      costPrice,
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

/**
 * Push current DB stock quantities to one or all marketplaces.
 * Always DB → marketplace direction; the database is never written.
 *
 * Body (all optional):
 *   targetMarketplace?: 'prom' | 'rozetka' | 'all'   (default: 'all')
 *
 * @route POST /api/products/sync/push
 */
export const syncAllQuantitiesToMarketplaces = async (
  req: Request,
  res: Response
): Promise<void> => {
  const target: 'prom' | 'rozetka' | 'all' =
    req.body?.targetMarketplace ?? 'all'
 
  const marketplacesToSync: KnownMarketplace[] =
    target === 'all'
      ? (Object.keys(MARKETPLACE_REGISTRY) as KnownMarketplace[])
      : [target as KnownMarketplace]
 
  // Single DB read — shared across all marketplace iterations
  const allProducts = await prisma.products.findMany({
    select: { productId: true, stockQuantity: true, externalIds: true },
  })
 
// Fetch the store-active flag once; reused inside pushProductsToMarketplaces
  const rozetkaActive = await prisma.settings
    .findUnique({ where: { key: 'rozetkaStoreActive' } })
    .then((s) => s?.value === 'true')
    .catch(() => true) // fail-open: if setting is missing, assume active

  const breakdown: Record<
    string,
    { updated: number; skipped: number; errors: string[] }
  > = {}
 
  for (const marketplace of marketplacesToSync) {
    const { hasLink } = MARKETPLACE_REGISTRY[marketplace]

    const eligible = allProducts.filter((p) =>
      hasLink(p.externalIds as ProductExternalIds | null),
    )

    if (eligible.length === 0) {
      breakdown[marketplace] = { updated: 0, skipped: 0, errors: [] }
      console.log(
        `⏭️  [sync/push] No products linked to ${marketplace} — skipping`,
      )
      continue
    }

    console.log(
      `🔄 [sync/push] Pushing ${eligible.length} products to ${marketplace}`,
    )

    // Build push items — each carries only what the push method needs
    const pushItems = eligible.map((p) => ({
      productId: p.productId,
      externalIds: p.externalIds as ProductExternalIds | null,
      updates: { quantity: p.stockQuantity },
    }))

    // ✅ Call the dedicated method — no DB-skip trick needed
    const { syncResults, syncErrors } =
      await productService.pushProductsToMarketplaces(
        pushItems,
        marketplace, // never 'all' — we iterate one marketplace at a time
        rozetkaActive,
      )

    breakdown[marketplace] = {
      updated:
        syncErrors.length === 0
          ? eligible.length
          : eligible.length - syncErrors.length,
      skipped: syncErrors.length,
      errors: syncErrors.map((e) => e.error ?? e.marketplace),
    }
  }

  const totalUpdated = Object.values(breakdown).reduce(
    (sum, b) => sum + b.updated,
    0,
  )
  const allErrors = Object.values(breakdown).flatMap((b) => b.errors)

  res.status(allErrors.length > 0 ? 207 : 200).json({
    success: allErrors.length === 0,
    updated: totalUpdated,
    errors: allErrors,
    breakdown,
  })
}