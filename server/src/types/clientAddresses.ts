//  server/src/types/clientAddresses.ts

import { DeliveryOption } from '../config/database'

export interface ClientAddress {
  addressId: string
  clientId: string
  address: string
  branchNumber?: string | null
  deliveryOptionName?: DeliveryOption | null
  isPrimary: boolean
  createdAt: Date
}

export interface CreateClientAddressInput {
  clientId: string
  address: string
  branchNumber?: string
  deliveryOptionName?: DeliveryOption
  isPrimary?: boolean
}

export interface UpdateClientAddressInput {
  address?: string
  branchNumber?: string
  deliveryOptionName?: DeliveryOption
  isPrimary?: boolean
}

// Generic response types - no need for separate interfaces
// Backend will return { success: boolean, data: ClientAddress | ClientAddress[] }
// or { success: boolean, message: string } for delete operations
