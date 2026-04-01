//  server/src/types/clientAddresses.ts

export interface ClientAddress {
  addressId: string
  clientId: string
  address: string
  branchNumber?: string | null
  deliveryOptionName?: string | null
  isPrimary: boolean
  createdAt: Date
}

export interface CreateClientAddressInput {
  clientId: string
  address: string
  branchNumber?: string
  deliveryOptionName?: string
  isPrimary?: boolean
}

export interface UpdateClientAddressInput {
  address?: string
  branchNumber?: string
  deliveryOptionName?: string
  isPrimary?: boolean
}

// Generic response types - no need for separate interfaces
// Backend will return { success: boolean, data: ClientAddress | ClientAddress[] }
// or { success: boolean, message: string } for delete operations
