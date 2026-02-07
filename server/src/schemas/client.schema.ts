// server/src/schemas/client.schema.ts
import { z } from 'zod'
import { DeliveryOption, PaymentOption } from '../config/database'

/**
 * Schema for creating a new client
 * Validates client data from frontend before creation
 */
export const createClientSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    secondName: z.string().optional(),
    phone: z.string().min(10, 'Valid phone number is required'),
    email: z.email().optional().nullable().or(z.literal('')),
    address: z.string().optional(),
    deliveryOptionName: z.enum(DeliveryOption).optional().nullable(),
    paymentOptionName: z.enum(PaymentOption).optional().nullable(),
    reliability: z.string().optional(),
  }),
})

/**
 * Schema for updating an existing client
 */
export const updateClientSchema = z.object({
  params: z.object({
    clientId: z.string().min(1, 'Client ID is required'),
  }),
  body: z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    secondName: z.string().optional(),
    phone: z.string().min(10).optional(),
    email: z.email().optional().nullable().or(z.literal('')),
    address: z.string().optional(),
    deliveryOptionName: z.enum(DeliveryOption).optional(),
    paymentOptionName: z.enum(PaymentOption).optional(),
    reliability: z.string().optional(),
  }),
})

/**
 * Schema for getting clients with search/filtering
 */
export const getClientsQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  }),
})

/**
 * Schema for getting a single client by ID
 */
export const getClientByIdSchema = z.object({
  params: z.object({
    clientId: z.string().min(1, 'Client ID is required'),
  }),
})

// ============================================
// INFERRED TYPES (Single Source of Truth)
// ============================================

export type CreateClientInput = z.infer<typeof createClientSchema>['body']
export type UpdateClientInput = z.infer<typeof updateClientSchema>['body']
export type ClientQueryParams = z.infer<typeof getClientsQuerySchema>['query']
export type ClientIdParam = z.infer<typeof getClientByIdSchema>['params']
