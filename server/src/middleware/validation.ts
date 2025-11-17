// server/src/middleware/validation.ts
import { Request, Response, NextFunction } from 'express'
import { z, ZodError } from 'zod'
import { ErrorFactory } from './errorHandler'

/**
 * Validation targets - which part of the request to validate
 */
type ValidationTarget = 'body' | 'query' | 'params' | 'combined'

/**
 * Options for the validation middleware
 */
interface ValidationOptions {
  /**
   * Which part of the request to validate
   * - 'body': Validate req.body
   * - 'query': Validate req.query
   * - 'params': Validate req.params
   * - 'combined': Validate { body, query, params } together
   */
  target?: ValidationTarget

  /**
   * Whether to strip unknown keys from the validated data
   */
  stripUnknown?: boolean
}

/**
 * Generic validation middleware that works with any Zod schema
 *
 * @param schema - The Zod schema to validate against
 * @param options - Validation options (target, stripUnknown)
 * @returns Express middleware function
 *
 * @example
 * // Validate request body
 * router.post('/products', validate(createProductSchema), asyncHandler(createProduct))
 *
 * @example
 * // Validate query parameters
 * router.get('/products', validate(getProductsQuerySchema, { target: 'query' }), asyncHandler(getProducts))
 *
 * @example
 * // Validate both params and body together
 * router.patch('/products/:productId', validate(updateSingleProductSchema, { target: 'combined' }), asyncHandler(updateProduct))
 */
export const validate =<
  Schema extends z.ZodType<any, any, any>
> (
  schema: Schema,
  options: ValidationOptions = {}
) => {
  const { target = 'body', stripUnknown = true } = options

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Determine what data to validate based on target
      let dataToValidate: any

      switch (target) {
        case 'body':
          dataToValidate = req.body
          break
        case 'query':
          dataToValidate = req.query
          break
        case 'params':
          dataToValidate = req.params
          break
        case 'combined':
          dataToValidate = {
            body: req.body,
            query: req.query,
            params: req.params,
          }
          break
        default:
          throw new Error(`Invalid validation target: ${target}`)
      }

      // Validate and parse the data
      const validatedData = await schema.parseAsync(dataToValidate)

      // Replace the original data with validated data
      switch (target) {
        case 'body':
          req.body = validatedData
          break
        case 'query':
          req.query = validatedData as any
          break
        case 'params':
          req.params = validatedData as any
          break
        case 'combined':
          // For combined validation, spread the validated data back
          const combinedData = validatedData as {
            body?: any
            query?: any
            params?: any
          }
          req.body = combinedData.body ?? req.body
          req.query = combinedData.query ?? req.query
          req.params = combinedData.params ?? req.params
          break
      }

      next()
    } catch (error) {
      // Handle Zod validation errors
      if (error instanceof ZodError) {
        // Format Zod errors into a user-friendly structure
        const formattedErrors = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }))

        // Create a validation error with formatted details
        const validationError =
          ErrorFactory.validationError('Validation failed')

        // Attach formatted errors to the error object
        ;(validationError as any).details = formattedErrors

        next(validationError)
      } else {
        // Handle other errors
        next(error)
      }
    }
  }
}

/**
 * Common validation schemas that can be reused across routes
 */
export const commonSchemas = {
  /**
   * Validates MongoDB-style IDs (24 hex characters)
   */
  mongoId: (fieldName = 'id') =>
    z.object({
      [fieldName]: z
        .string()
        .regex(/^[a-f\d]{24}$/i, `Invalid ${fieldName} format`),
    }),

  /**
   * Validates pagination parameters
   */
  pagination: {
    page: z
      .string()
      .optional()
      .transform((val: string | undefined) => (val ? parseInt(val, 10) : 1))
      .refine((val) => val > 0, 'Page must be greater than 0'),
    limit: z
      .string()
      .optional()
      .transform((val: string | undefined) => (val ? parseInt(val, 10) : 10))
      .refine(
        (val) => val > 0 && val <= 100,
        'Limit must be between 1 and 100'
      ),
  },

  /**
   * Validates sort parameters
   */
  sort: z.object({
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  }),
}

// Re-export zod for convenience
export { z } from 'zod'
