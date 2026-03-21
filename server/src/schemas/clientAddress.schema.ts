//	server/src/schemas/clientAddress.schema.ts

import { z } from 'zod'

// Reusable param validators
const clientIdParam = z.object({
  clientId: z.string().uuid('Невірний ID клієнта'),
})

const addressIdParam = z.object({
  addressId: z.string().uuid('Невірний ID адреси'),
})

// Body schemas
const addressBodyBase = z.object({
  address: z.string().min(1, "Адреса є обов'язковою"),
  branchNumber: z.string().optional(),
  deliveryOptionName: z.string().optional(),
  isPrimary: z.boolean().optional().default(false),
})

// Request schemas
export const createClientAddressSchema = z.object({
  body: addressBodyBase,
  params: clientIdParam,
})

export const updateClientAddressSchema = z.object({
  body: addressBodyBase.partial(), // All fields optional for update
  params: addressIdParam,
})

export const getClientAddressesSchema = z.object({
  params: clientIdParam,
})

export const deleteClientAddressSchema = z.object({
  params: addressIdParam,
})

// Inferred types
export type CreateClientAddressInput = z.infer<typeof createClientAddressSchema>
export type UpdateClientAddressInput = z.infer<typeof updateClientAddressSchema>
export type GetClientAddressesInput = z.infer<typeof getClientAddressesSchema>
export type DeleteClientAddressInput = z.infer<typeof deleteClientAddressSchema>
