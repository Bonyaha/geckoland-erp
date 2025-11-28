// server/src/types/products.ts

import { Source, Prisma } from '../config/database'
import { Decimal } from '@prisma/client/runtime/library'
import { CreateProductInput } from '../schemas/product.schema'
/**
 * ============================================
 * PRODUCT DOMAIN TYPES
 * ============================================
 * Centralized type definitions for product management
 * and marketplace synchronization
 */

// ============================================
// QUERY AND FILTER TYPES
// ============================================

/**
 * Filter parameters for querying products.
 * Used when fetching products with search functionality.
 *
 * @remarks
 * Currently supports simple text search by product name.
 * Can be extended with additional filters like price range, category, etc.
 *
 * @example
 * const filters: ProductQueryParams = {
 *   search: 'laptop'
 * }
 * const products = await productService.getProducts(filters.search)
 */
export interface ProductQueryParams {
  search?: string
}

// ============================================
// PRODUCT UPDATE TYPES
// ============================================

/**
 * Allowed update parameters for single or batch product updates.
 * Matches the Zod validation schema in product.schema.ts.
 *
 * @remarks
 * - quantity: Stock quantity (must be non-negative)
 * - price: Product price (must be non-negative)
 *
 * These are the only fields that can be updated through the API.
 * For other field updates, use Prisma directly or create specialized endpoints.
 *
 * @example
 * const updates: ProductUpdateParams = {
 *   quantity: 15,
 *   price: 299.99
 * }
 *
 * await productService.updateSingleProduct({
 *   productId: 'prod_123',
 *   updates,
 *   targetMarketplace: 'all'
 * })
 */
export interface ProductUpdateParams {
  quantity?: number
  price?: number
}

/**
 * Input structure for single product update operations.
 * Used by the updateSingleProduct endpoint.
 *
 * @remarks
 * targetMarketplace determines where the update is applied:
 * - 'all': Update app DB and sync to all marketplaces (default)
 * - 'prom': Update only Prom marketplace
 * - 'rozetka': Update only Rozetka marketplace
 *
 * When targeting a specific marketplace (not 'all'), the system validates
 * that the new quantity doesn't exceed warehouse stock.
 *
 * @example
 * const input: SingleProductUpdateInput = {
 *   productId: 'prod_123',
 *   updates: { quantity: 5, price: 199.99 },
 *   targetMarketplace: 'prom'
 * }
 *
 * const result = await productService.updateSingleProduct(input)
 */
export interface SingleProductUpdateInput {
  productId: string
  updates: ProductUpdateParams
  targetMarketplace?: 'prom' | 'rozetka' | 'all'
}

/**
 * Individual product update in a batch operation.
 * Each item specifies which product to update and what changes to make.
 *
 * @example
 * const batchItem: BatchProductUpdateItem = {
 *   productId: 'prod_123',
 *   updates: { quantity: 10 }
 * }
 */
export interface BatchProductUpdateItem {
  productId: string
  updates: ProductUpdateParams
}

/**
 * Input structure for batch product update operations.
 * Allows updating multiple products in a single request.
 *
 * @remarks
 * Batch updates are more efficient than individual updates when changing
 * multiple products at once. They use:
 * - Prisma transactions for database updates
 * - Marketplace batch APIs when available
 *
 * All products are validated before any updates begin.
 *
 * @example
 * const input: BatchProductUpdateInput = {
 *   products: [
 *     { productId: 'prod_1', updates: { quantity: 10 } },
 *     { productId: 'prod_2', updates: { price: 199.99 } },
 *     { productId: 'prod_3', updates: { quantity: 5, price: 149.99 } }
 *   ],
 *   targetMarketplace: 'all'
 * }
 *
 * const result = await productService.updateBatchProducts(input)
 */
export interface BatchProductUpdateInput {
  products: BatchProductUpdateItem[]
  targetMarketplace?: 'prom' | 'rozetka' | 'all'
}

// ============================================
// PRODUCT UPDATE RESULT TYPES
// ============================================

/**
 * Detailed result from a single product update operation.
 * Provides feedback on success/failure and marketplace sync status.
 *
 * @remarks
 * Use this type instead of generic success/error responses for:
 * - Detailed error reporting
 * - Tracking which marketplaces were successfully synced
 * - Debugging synchronization issues
 *
 * @example
 * const result: SingleProductUpdateResult = {
 *   success: true,
 *   message: 'Product updated and synced everywhere successfully',
 *   productId: 'prod_123',
 *   updates: { quantity: 10, price: 299.99 },
 *   syncedMarketplaces: ['Prom', 'Rozetka']
 * }
 *
 * if (!result.success) {
 *   console.error('Sync errors:', result.errors)
 * }
 */
export interface SingleProductUpdateResult {
  success: boolean
  message: string
  productId: string
  updates: ProductUpdateParams
  syncedMarketplaces: string[]
  errors?: Array<{
    marketplace: string
    success: boolean
    error?: string
  }>
}

/**
 * Summary statistics for batch product update operations.
 * Provides aggregate counts and marketplace sync information.
 *
 * @example
 * const summary: BatchUpdateSummary = {
 *   totalRequested: 10,
 *   successfulDatabaseUpdates: 9,
 *   failedDatabaseUpdates: 1,
 *   marketplacesSynced: ['Prom (8 products)', 'Rozetka (9 products)'],
 *   marketplaceErrors: [
 *     { marketplace: 'Prom', success: false, error: 'Product not found' }
 *   ]
 * }
 */
export interface BatchUpdateSummary {
  totalRequested: number
  successfulDatabaseUpdates: number
  failedDatabaseUpdates: number
  marketplacesSynced: string[]
  marketplaceErrors?: Array<{
    marketplace: string
    success: boolean
    error?: string
  }>
}

/**
 * Detailed results for batch update operations.
 * Lists which products succeeded and which failed.
 *
 * @example
 * const details: BatchUpdateDetails = {
 *   successfulProducts: ['prod_1', 'prod_2', 'prod_3'],
 *   failedProducts: [
 *     { productId: 'prod_4', error: 'Product not found' }
 *   ]
 * }
 */
export interface BatchUpdateDetails {
  successfulProducts: string[]
  failedProducts?: Array<{
    productId: string
    error: string
  }>
}

/**
 * Complete result from batch product update operations.
 * Combines summary statistics and detailed product-level results.
 *
 * @remarks
 * Returns HTTP 200 if all updates succeeded, 207 (Multi-Status) if some failed.
 *
 * @example
 * const result: BatchProductUpdateResult = {
 *   success: true,
 *   message: 'Batch update completed',
 *   summary: {
 *     totalRequested: 10,
 *     successfulDatabaseUpdates: 10,
 *     failedDatabaseUpdates: 0,
 *     marketplacesSynced: ['Prom (10 products)', 'Rozetka (10 products)']
 *   },
 *   details: {
 *     successfulProducts: ['prod_1', 'prod_2', ...],
 *     failedProducts: undefined
 *   }
 * }
 */
export interface BatchProductUpdateResult {
  success: boolean
  message: string
  summary: BatchUpdateSummary
  details: BatchUpdateDetails
}

// ============================================
// PRODUCT CREATION TYPES
// ============================================

/**
 * Complete input data for creating a new product.
 * Matches the Zod validation schema in product.schema.ts.
 *
 * @remarks
 * Required fields:
 * - productId: Unique identifier
 * - name: Product name
 * - price: Product price (Decimal)
 * - stockQuantity: Initial stock level (integer)
 * - available: Availability status (boolean)
 * - externalIds: Marketplace IDs (can be empty object)
 * - images: Image URLs (can be empty array)
 *
 * Optional fields have defaults or are nullable.
 *
 * @example
 * const productData: ProductCreateInput = {
 *   productId: 'prod_123',
 *   name: 'Gaming Laptop',
 *   price: 25000,
 *   stockQuantity: 10,
 *   available: true,
 *   externalIds: { prom: '123456' },
 *   images: ['https://example.com/image.jpg'],
 *   sku: 'LAPTOP-001',
 *   description: 'High-performance gaming laptop',
 *   mainImage: 'https://example.com/main.jpg',
 *   source: 'prom',
 *   currency: 'UAH',
 *   measureUnit: 'шт.'
 * }
 *
 * const product = await productService.createProduct(productData)
 */
export type ProductCreateInput = CreateProductInput

// ============================================
// MARKETPLACE SYNC TYPES
// ============================================

/**
 * Result from syncing new products from marketplaces.
 * Tracks how many products were created and any errors encountered.
 *
 * @remarks
 * The sync operation:
 * 1. Fetches products from Prom and Rozetka APIs
 * 2. Compares with existing products in database
 * 3. Creates only new products that don't exist yet
 * 4. Continues processing even if some products fail
 *
 * success is false if any errors occurred during sync.
 *
 * @example
 * const result: ProductSyncResult = {
 *   success: true,
 *   productsCreatedFromProm: 15,
 *   productsCreatedFromRozetka: 8,
 *   totalCreated: 23,
 *   errors: []
 * }
 *
 * if (!result.success) {
 *   console.error('Sync errors:', result.errors)
 * }
 */
export interface ProductSyncResult {
  success: boolean
  productsCreatedFromProm: number
  productsCreatedFromRozetka: number
  totalCreated: number
  errors: string[]
}

/**
 * Marketplace-specific product data structure from Prom.
 * Used when creating products from Prom API response.
 *
 * @remarks
 * This is the transformed structure after fetching from Prom API.
 * See fetchPromProductsWithTransformation() for transformation logic.
 *
 * @example
 * const promProduct: PromProductData = {
 *   productId: '1234567',
 *   sku: 'LAPTOP-001',
 *   name: 'Gaming Laptop',
 *   price: '25000.00',
 *   stockQuantity: 10,
 *   promQuantity: 10,
 *   available: true,
 *   externalIds: { prom: '1234567', rozetka: null },
 *   source: 'prom',
 *   lastPromSync: new Date()
 * }
 */
export interface PromProductData {
  productId: string
  sku?: string | null
  externalIds: {
    prom: string
    rozetka: string | null
  }
  name: string
  price: string
  priceOld?: string | null
  pricePromo?: string | null
  updatedPrice?: string | null
  stockQuantity: number
  promQuantity?: number
  available: boolean
  description?: string | null
  mainImage?: string | null
  images: string[]
  currency: string
  dateModified?: Date
  lastSynced: Date
  lastPromSync: Date
  needsSync: boolean
  needsPromSync: boolean
  needsRozetkaSync: boolean
  categoryData?: any
  measureUnit?: string
  rozetkaQuantity?: number | null
  lastRozetkaSync?: Date | null
  source: Source
}

/**
 * Marketplace-specific product data structure from Rozetka.
 * Used when creating products from Rozetka API response.
 *
 * @remarks
 * This is the transformed structure after fetching from Rozetka API.
 * See fetchRozetkaProductsWithTransformation() for transformation logic.
 *
 * @example
 * const rozetkaProduct: RozetkaProductData = {
 *   productId: '498694064',
 *   sku: 'LAPTOP-001',
 *   name: 'Gaming Laptop',
 *   price: '25000',
 *   stockQuantity: 10,
 *   available: true,
 *   externalIds: { prom: null, rozetka: '498694064' },
 *   source: 'rozetka'
 * }
 */
export interface RozetkaProductData {
  productId: string
  sku?: string | null
  externalIds: {
    prom: string | null
    rozetka: string
  }
  name: string
  price: string
  stockQuantity: number
  available: boolean
  priceOld?: string | null
  pricePromo?: string | null
  updatedPrice?: string | null
  mainImage?: string | null
  images: string[]
  dateModified?: Date | null
  categoryData?: {
    id: number | null
    title: string | null
  }
  source: Source
}

// ============================================
// PRODUCT ENRICHMENT TYPES
// ============================================

/**
 * Product data enriched with external marketplace information.
 * Used during product synchronization and enrichment processes.
 *
 * @remarks
 * Enrichment process:
 * 1. Start with base product data (from CRM)
 * 2. Map external IDs from Prom/Rozetka
 * 3. Enrich with category data and descriptions
 * 4. Normalize and validate data
 * 5. Save to database
 *
 * @example
 * // Base product
 * let product = {
 *   productId: 'prod_123',
 *   sku: 'LAPTOP-001',
 *   name: 'Gaming Laptop',
 *   price: 25000
 * }
 *
 * // After enrichment with Prom IDs
 * const enriched: EnrichedProductData = {
 *   ...product,
 *   externalIds: { prom: '1234567' }
 * }
 *
 * // After enrichment with categories
 * const fullyEnriched: EnrichedProductData = {
 *   ...enriched,
 *   categoryData: {
 *     prom: { id: 100, name: 'Ноутбуки' }
 *   }
 * }
 */
export interface EnrichedProductData {
  productId: string
  sku?: string | null
  name: string
  price: number | string
  stockQuantity: number
  externalIds?: {
    prom?: string
    rozetka?: {
      rz_item_id?: string
      item_id?: string
    }
  }
  categoryData?: {
    prom?: {
      id: number
      name: string
    }
    rozetka?: {
      id: number
      name: string
    }
  }
  description?: string | null
  [key: string]: any // Allow additional fields during enrichment
}

// ============================================
// VALIDATION AND ERROR TYPES
// ============================================

/**
 * Validation error for product data.
 * Used when validating product input before creation or update.
 *
 * @example
 * function validateProduct(data: any): ProductValidationError[] {
 *   const errors: ProductValidationError[] = []
 *
 *   if (!data.productId) {
 *     errors.push({
 *       field: 'productId',
 *       message: 'Product ID is required',
 *       value: data.productId
 *     })
 *   }
 *
 *   if (data.price < 0) {
 *     errors.push({
 *       field: 'price',
 *       message: 'Price must be non-negative',
 *       value: data.price
 *     })
 *   }
 *
 *   return errors
 * }
 */
export interface ProductValidationError {
  field: string
  message: string
  value?: any
}

// ============================================
// TYPE GUARDS AND HELPERS
// ============================================

/**
 * Type guard to check if a value is a valid Source enum value.
 *
 * @param value - The value to check
 * @returns True if value is a valid Source enum value
 *
 * @example
 * const source = req.query.source as string
 *
 * if (isProductSource(source)) {
 *   // TypeScript now knows source is Source type
 *   const products = await productService.getProducts()
 * } else {
 *   throw new Error(`Invalid product source: ${source}`)
 * }
 */
export function isProductSource(value: string): value is Source {
  return Object.values(Source).includes(value as Source)
}

/**
 * Helper function to create product query parameters with defaults.
 * Provides consistent parameter handling across the application.
 *
 * @param params - Partial query parameters
 * @returns Complete ProductQueryParams with defaults
 *
 * @example
 * // Create query with search term
 * const query = createProductQueryParams({ search: 'laptop' })
 * // Returns: { search: 'laptop' }
 *
 * // Create empty query
 * const emptyQuery = createProductQueryParams({})
 * // Returns: { search: undefined }
 *
 * @example
 * // Use in API endpoint
 * router.get('/products', (req, res) => {
 *   const query = createProductQueryParams({
 *     search: req.query.search as string
 *   })
 *
 *   const products = await productService.getProducts(query.search)
 *   res.json(products)
 * })
 */
export function createProductQueryParams(
  params: Partial<ProductQueryParams> = {}
): ProductQueryParams {
  return {
    search: params.search,
  }
}

/**
 * Helper to validate product update parameters.
 * Ensures updates contain at least one valid field.
 *
 * @param updates - Update parameters to validate
 * @returns Validation error array (empty if valid)
 *
 * @example
 * const updates = { quantity: 10 }
 * const errors = validateProductUpdates(updates)
 *
 * if (errors.length > 0) {
 *   throw new ValidationError(errors)
 * }
 *
 * @example
 * // Invalid updates
 * const invalidUpdates = {}
 * const errors = validateProductUpdates(invalidUpdates)
 * // Returns: [{ field: 'updates', message: 'No valid update parameters provided' }]
 */
export function validateProductUpdates(
  updates: ProductUpdateParams
): ProductValidationError[] {
  const errors: ProductValidationError[] = []

  // Check if at least one update field is provided
  if (updates.quantity === undefined && updates.price === undefined) {
    errors.push({
      field: 'updates',
      message: 'No valid update parameters provided',
      value: updates,
    })
  }

  // Validate quantity
  if (updates.quantity !== undefined) {
    if (typeof updates.quantity !== 'number' || updates.quantity < 0) {
      errors.push({
        field: 'quantity',
        message: 'Quantity must be a non-negative number',
        value: updates.quantity,
      })
    }
  }

  // Validate price
  if (updates.price !== undefined) {
    if (typeof updates.price !== 'number' || updates.price < 0) {
      errors.push({
        field: 'price',
        message: 'Price must be a non-negative number',
        value: updates.price,
      })
    }
  }

  return errors
}
