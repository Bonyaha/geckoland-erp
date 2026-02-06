// server/src/types/clients.ts

import { DeliveryOption, PaymentOption } from '../config/database'
import { Decimal } from '@prisma/client/runtime/library'

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
 * Type guard to check if a delivery option is valid
 */
export function isDeliveryOption(value: string): value is DeliveryOption {
  return Object.values(DeliveryOption).includes(value as DeliveryOption)
}

/**
 * Type guard to check if a payment option is valid
 */
export function isPaymentOption(value: string): value is PaymentOption {
  return Object.values(PaymentOption).includes(value as PaymentOption)
}
