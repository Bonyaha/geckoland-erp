// server/src/schemas/product.schema.ts
import { z } from 'zod'
// Import the enum directly from the generated Prisma client
import { Source } from '@prisma/client'

// --- CREATE PRODUCT SCHEMA ---
export const createProductSchema = z.object({
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

export type CreateProductInput = z.infer<typeof createProductSchema>

// --- GET PRODUCTS QUERY SCHEMA ---
// This defines the *expected shape* of the req.query object
export const getProductsQuerySchema = z.object({
  search: z.string().optional(), // 'search' must be a string, if it exists
})
// This exports a TypeScript type based on the schema


// --- UPDATE SCHEMAS ---

const productUpdateParamsSchema = z
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
const updateProductParamsSchema = z.object({
  productId: z.string().min(1, 'productId is required in params'),
})

const updateProductBodySchema = z
  .object({
    targetMarketplace: z.enum(['prom', 'rozetka', 'all']).optional(),
  })
  .extend(productUpdateParamsSchema.shape)

export const updateSingleProductSchema = z.object({
  params: updateProductParamsSchema,
  body: updateProductBodySchema,
})

// --- Schema for Batch Update ---

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

// Export individual schemas for route-level validation
export { updateProductParamsSchema, updateProductBodySchema }