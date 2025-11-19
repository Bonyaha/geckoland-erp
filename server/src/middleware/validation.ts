// server/src/middleware/validation.ts
import { Request, Response, NextFunction } from 'express'
import { z, ZodType, ZodError } from 'zod'
import { ErrorFactory } from './errorHandler'


interface RequestValidation {
  body?: any
  query?: any
  params?: any
}
/**
 * Generic validation middleware that works with any Zod schema
 *
 * It validates the request against a schema that describes the expected structure of { body, query, params }.
 *
 * @example
 * // In my schema file:
 * const mySchema = z.object({
 * body: z.object({ name: z.string() }),
 * query: z.object({ sort: z.string() })
 * })
 *
 * // In a route:
 * router.post('/', validate(mySchema), controller)
 */

// We constrain the generic: The Output (first arg) must extend RequestValidation
export const validate = <Schema extends ZodType<RequestValidation, any, any>>(
  schema: Schema
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Validate the entire request structure against the schema
      // Zod will strip unknown keys (like 'query' if your schema only has 'body')
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      })

      // 2. Replace request data with the validated/transformed data
      // We only assign back what was present in the schema result
      if (parsed.body) req.body = parsed.body
      if (parsed.query) req.query = parsed.query
      if (parsed.params) req.params = parsed.params

      return next()
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }))

        const validationError =
          ErrorFactory.validationError('Validation failed')
        ;(validationError as any).details = formattedErrors

        return next(validationError)
      }
      return next(error)
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
