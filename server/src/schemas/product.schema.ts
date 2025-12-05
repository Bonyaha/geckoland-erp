// server/src/schemas/product.schema.ts
import { z } from 'zod'
import { Source } from '../config/database'

// --- CREATE PRODUCT SCHEMA ---
export const createProductBodySchema = z.object({
  // --- Required Fields (per Prisma schema) ---
  productId: z.string().min(1, 'productId is required'),
  name: z.string().min(1, 'name is required'),
  price: z.number().nonnegative('price must be a non-negative number'),
  stockQuantity: z
    .number()
    .int()
    .nonnegative('stockQuantity must be a non-negative integer'),
  available: z.boolean(), // This is required in your schema (no '?' or @default)

  // externalIds is 'Json', not optional
  externalIds: z.any().default({}),

  // images is 'String[]', not optional, but can be empty
  images: z.array(z.string()).default([]),

  // --- Fields with Defaults (optional in Zod) ---
  source: z.enum(Source).default(Source.prom).optional(),
  needsSync: z.boolean().default(false).optional(),
  needsPromSync: z.boolean().default(false).optional(),
  needsRozetkaSync: z.boolean().default(false).optional(),

  // --- Optional Fields (with '?' in Prisma) ---
  sku: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  mainImage: z.string().nullable().optional(),
  priceOld: z.number().nonnegative().nullable().optional(),
  pricePromo: z.number().nonnegative().nullable().optional(),
  updatedPrice: z.number().nonnegative().nullable().optional(),
  currency: z.string().nullable().optional(),
  dateModified: z.iso
    .datetime({ message: 'Invalid ISO 8601 date' })
    .nullable()
    .optional(),
  lastSynced: z.iso
    .datetime({ message: 'Invalid ISO 8601 date' })
    .nullable()
    .optional(),
  categoryData: z.any().nullable().optional(), // Json?
  measureUnit: z.string().nullable().optional(),
  lastPromSync: z.iso
    .datetime({ message: 'Invalid ISO 8601 date' })
    .nullable()
    .optional(),
  lastRozetkaSync: z.iso
    .datetime({ message: 'Invalid ISO 8601 date' })
    .nullable()
    .optional(),
  promQuantity: z.number().int().nullable().optional(),
  rozetkaQuantity: z.number().int().nullable().optional(),
  costPrice: z.number().nonnegative().nullable().optional(),
})

// Schema for the Route (wraps the body)
export const createProductSchema = z.object({
  body: createProductBodySchema,
})

// --- GET PRODUCTS QUERY SCHEMA ---
// This defines the *expected shape* of the req.query object
export const getProductsQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    stockFilter: z
      .enum(['all', 'inStock', 'outOfStock'])
      .default('all')
      .optional(),
  }),
})


// --- UPDATE SCHEMAS ---

export const productUpdateParamsSchema = z
  .object({
    quantity: z.number().nonnegative().optional(),
    price: z.number().nonnegative().optional(),
  })
  .strict() // Fails if other properties (e.g., "name") are passed
  .refine(
    (data) => Object.keys(data).length > 0, // Must have at least one key
    { message: 'No valid update parameters provided' }
  )

// Single update: separate params and body schemas for clarity
export const updateProductParamsSchema = z.object({
  productId: z.string().min(1, 'productId is required in params'),
})

export const updateProductBodySchema = z
  .object({
    targetMarketplace: z.enum(['prom', 'rozetka', 'all']).optional(),
  })
  .extend(productUpdateParamsSchema.shape)

export const updateSingleProductSchema = z.object({
  params: updateProductParamsSchema,
  body: updateProductBodySchema,
})

// --- BATCH UPDATE SCHEMAS ---

const batchProductUpdateSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  updates: productUpdateParamsSchema, // Re-use the update schema
})

export const updateBatchProductSchema = z.object({
  body: z.object({
    targetMarketplace: z.enum(['prom', 'rozetka', 'all']).optional(),
    products: z
      .array(batchProductUpdateSchema)
      .min(1, 'products array is required and must not be empty'),
  }),
})

// ============================================
// INFERRED TYPES (Single Source of Truth)
// ============================================

export type ProductUpdateParams = z.infer<typeof productUpdateParamsSchema>
export type CreateProductInput = z.infer<typeof createProductBodySchema>
export type ProductQueryParams = z.infer<typeof getProductsQuerySchema>['query']
export type SingleProductUpdateInput = {
  productId: string
  updates: ProductUpdateParams
  targetMarketplace?: 'prom' | 'rozetka' | 'all'
}
export type BatchProductUpdateItem = z.infer<
  typeof batchProductUpdateSchema
>
export type BatchProductUpdateInput = z.infer<
  typeof updateBatchProductSchema
>['body']
