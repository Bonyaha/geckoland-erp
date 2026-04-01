// server/src/types/clients.ts

/**
 * ============================================
 * CLIENT DOMAIN TYPES
 * ============================================
 * Types that are NOT validated by Zod (internal use only)
 * For validated types, import from schemas/client.schema.ts
 */

// Re-export validated types from schema
export type {
  CreateClientInput,
  UpdateClientInput,
  ClientQueryParams,
  ClientIdParam,
} from '../schemas/client.schema'

// ============================================
// CLIENT QUERY RESULT TYPES
// ============================================

/**
 * Pagination metadata for client list queries
 */
export interface ClientPaginationMeta {
  page: number
  limit: number
  total: number
  pages: number
}

/**
 * Result structure for client list queries
 * Includes both clients array and pagination metadata
 */
export interface ClientQueryResult {
  clients: any[] // Prisma.ClientsGetPayload<{}>[]
  pagination: ClientPaginationMeta
}

/**
 * Filter parameters for querying clients
 */
export interface ClientFilterParams {
  search?: string
  page?: number
  limit?: number
}

// ============================================
// CLIENT SERVICE RESULT TYPES
// ============================================

/**
 * Result of client creation operations
 */
export interface ClientCreationResult {
  clientId: string
  success: boolean
  message?: string
}

/**
 * Result of client update operations
 */
export interface ClientUpdateResult {
  success: boolean
  message: string
  clientId: string
}

/**
 * Validation error for client data
 */
export interface ClientValidationError {
  field: string
  message: string
  value?: any
}

// ============================================
// TYPE GUARDS AND HELPERS
// ============================================

/**
 * Helper function to create client filter parameters with defaults
 */
export function createClientFilterParams(
  params: Partial<ClientFilterParams> = {},
): Required<ClientFilterParams> {
  return {
    search: params.search || '',
    page: params.page || 1,
    limit: params.limit || 20,
  }
}

/**
 * Calculates reliability percentage based on order history
 * Formula: $reliability = \frac{successfulOrders}{totalOrders} \times 100$
 */
export function calculateReliability(totalOrders: number, successfulOrders: number): number {
  if (totalOrders <= 0) return 100; // New clients start at 100%
  
  const percentage = (successfulOrders / totalOrders) * 100;
  return Math.round(percentage * 100) / 100; // Rounds to 2 decimal places
}