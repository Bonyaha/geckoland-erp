// server/src/services/clients/clientService.ts
import prisma, { Prisma } from '../../config/database'
import { ErrorFactory } from '../../middleware/errorHandler'
import {
  CreateClientInput,
  UpdateClientInput,
  ClientFilterParams,
  ClientQueryResult,
  ClientCreationResult,
  ClientUpdateResult,
  calculateReliability,
} from '../../types/clients'
import {
  CreateClientAddressInput,
  UpdateClientAddressInput,
  ClientAddress,
} from '../../types/clientAddresses'

/**
 * Service class for client-related operations
 * Handles CRUD operations for clients
 */
class ClientService {
  /**
   * Normalize phone number to E.164 format (+380...)
   */
  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '')

    if (digits.startsWith('380')) {
      return `+${digits}`
    } else if (digits.startsWith('0') && digits.length === 10) {
      return `+380${digits.substring(1)}`
    } else {
      return `+${digits}`
    }
  }

  /**
   * PRIVATE: Internal method to create client in database
   * Shared logic used by both createClient and getOrCreateClient
   */
  private async _createClientInDatabase(
    clientData: CreateClientInput,
    normalizedPhone: string,
  ) {
    const client = await prisma.clients.create({
      data: {
        firstName: clientData.firstName,
        lastName: clientData.lastName,
        secondName: clientData.secondName || null,
        phone: normalizedPhone,
        email: clientData.email || null,
        address: clientData.address || null,
      },
    })

    console.log(`✅ Created new client: ${client.clientId}`)
    return client
  }

  /**
   * Create a new client in the database
   * FAILS if client with same phone already exists
   *
   * @param clientData - Client information from frontend
   * @returns Created client result with clientId
   * @throws {AppError} If client with phone already exists
   *
   * @example
   * const result = await clientService.createClient({
   *   firstName: 'Іван',
   *   lastName: 'Петренко',
   *   phone: '0501234567',
   *   email: 'ivan@example.com'
   * })
   */
  async createClient(
    clientData: CreateClientInput,
  ): Promise<ClientCreationResult> {
    try {
      // Normalize phone number
      const normalizedPhone = this.normalizePhone(clientData.phone)

      // Check if client with this phone already exists
      const existingClient = await prisma.clients.findUnique({
        where: { phone: normalizedPhone },
      })

      if (existingClient) {
        throw ErrorFactory.conflict(
          `Client with phone number ${normalizedPhone} already exists`,
        )
      }

      // Create the client
      const client = await this._createClientInDatabase(
        clientData,
        normalizedPhone,
      )

      console.log(`✅ Created new client: ${client.clientId}`)

      return {
        clientId: client.clientId,
        success: true,
        message: 'Client created successfully',
      }
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Unique constraint violation
        throw ErrorFactory.conflict(
          'Client with this phone number already exists',
        )
      }
      throw error
    }
  }

  /**
   * Get clients with optional search and pagination
   *
   * @param params - Query parameters for filtering and pagination
   * @returns Clients array with pagination metadata
   *
   * @example
   * const result = await clientService.getClients({
   *   search: 'Петренко',
   *   page: 1,
   *   limit: 20
   * })
   */
  async getClients(
    params: ClientFilterParams = {},
  ): Promise<ClientQueryResult> {
    const { search, page = 1, limit = 20 } = params

    const skip = (page - 1) * limit

    // Build where clause for search
    const where: Prisma.ClientsWhereInput = {}

    if (search && search.length > 0) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { secondName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Fetch clients with pagination
    const [clients, total] = await Promise.all([
      prisma.clients.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.clients.count({ where }),
    ])

    return {
      clients,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Get a single client by ID
   *
   * @param clientId - The client's unique identifier
   * @returns Client data
   * @throws {AppError} If client not found
   */
  async getClientById(clientId: string) {
    const client = await prisma.clients.findUnique({
      where: { clientId },
      include: {
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!client) {
      throw ErrorFactory.notFound(`Client with ID ${clientId} not found`)
    }

    return client
  }

  /**
   * Update an existing client
   *
   * @param clientId - The client's unique identifier
   * @param updates - Fields to update
   * @returns Update result
   * @throws {AppError} If client not found
   */
  async updateClient(
    clientId: string,
    updates: UpdateClientInput,
  ): Promise<ClientUpdateResult> {
    try {
      // Check if client exists
      const existingClient = await prisma.clients.findUnique({
        where: { clientId },
      })

      if (!existingClient) {
        throw ErrorFactory.notFound(`Client with ID ${clientId} not found`)
      }

      // Prepare update data
      const updateData: Prisma.ClientsUpdateInput = {}

      if (updates.firstName) updateData.firstName = updates.firstName
      if (updates.lastName) updateData.lastName = updates.lastName
      if (updates.secondName !== undefined)
        updateData.secondName = updates.secondName || null
      if (updates.phone) {
        updateData.phone = this.normalizePhone(updates.phone)
      }
      if (updates.email !== undefined) updateData.email = updates.email || null
      if (updates.address !== undefined)
        updateData.address = updates.address || null

      // Update the client
      await prisma.clients.update({
        where: { clientId },
        data: updateData,
      })

      console.log(`✅ Updated client: ${clientId}`)

      return {
        success: true,
        message: 'Client updated successfully',
        clientId,
      }
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw ErrorFactory.conflict(
          'Client with this phone number already exists',
        )
      }
      throw error
    }
  }

  /**
   * Get or create a client based on phone number
   * IDEMPOTENT: Returns existing client if found, creates new if not
   *
   * This is the preferred method for order creation flows where you want
   * to ensure a client exists without failing on duplicates.
   *
   * @param clientData - Client data (will create if not found)
   * @returns Existing or newly created client (full object)
   *
   * @example
   * // Safe to call multiple times with same phone
   * const client = await clientService.getOrCreateClient({
   *   firstName: 'Іван',
   *   lastName: 'Петренко',
   *   phone: '0501234567'
   * })
   */
  async getOrCreateClient(clientData: CreateClientInput) {
    const normalizedPhone = this.normalizePhone(clientData.phone)

    // Try to find existing client
    let client = await prisma.clients.findUnique({
      where: { phone: normalizedPhone },
    })

    if (client) {
      console.log(`ℹ️ Found existing client: ${client.clientId}`)
      return client
    }
    // Client not found, create new one using shared logic
    console.log(`📝 Creating new client with phone: ${normalizedPhone}`)
    return await this._createClientInDatabase(clientData, normalizedPhone)
  }

  /**
   * Update client order statistics (totalOrders and totalSpent)
   * Called after order creation or when order status changes to DELIVERED
   *
   * @param clientPhone - Client's phone number
   * @param orderAmount - Order amount to add to totalSpent
   * @param increment - Whether to increment (true) or decrement (false) order count
   *
   * @example
   * // After creating a delivered order
   * await clientService.updateClientStats('+380501234567', 1500.00, true)
   *
   * // After canceling an order
   * await clientService.updateClientStats('+380501234567', 1500.00, false)
   */
  async updateClientStats(
    clientPhone: string,
    orderAmount: number,
    increment: boolean = true,
    isSuccessful: boolean = false,
  ): Promise<void> {
    try {
      const normalizedPhone = this.normalizePhone(clientPhone)

      // Find client by phone
      const client = await prisma.clients.findUnique({
        where: { phone: normalizedPhone },
      })

      if (!client) {
        console.warn(
          `⚠️ Client not found for phone: ${normalizedPhone}. Cannot update stats.`,
        )
        return
      }

      // Calculate new values
      const orderDelta = increment ? 1 : -1
      const amountDelta = increment ? orderAmount : -orderAmount
      const successDelta = isSuccessful ? (increment ? 1 : -1) : 0

      const newTotalOrders = Math.max(0, client.totalOrders + orderDelta)
      const newSuccessfulOrders = Math.max(0,client.successfulOrders + successDelta)

      const newReliability = calculateReliability(newTotalOrders,newSuccessfulOrders)

      // Update client statistics
      await prisma.clients.update({
        where: { clientId: client.clientId },
        data: {
          totalOrders: newTotalOrders,
          successfulOrders: newSuccessfulOrders,
          totalSpent: {
            increment: amountDelta,
          },
          reliability: newReliability,
        },
      })

      console.log(
        `✅ Updated client stats for ${normalizedPhone}: ${increment ? '+' : '-'}1 order, ${increment ? '+' : '-'}${orderAmount} spent`,
      )
    } catch (error: any) {
      console.error('Failed to update client stats:', error)
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Get all addresses for a client
   *
   * @param clientId - The client's unique identifier
   * @returns Array of client addresses
   */
  async getClientAddresses(clientId: string): Promise<ClientAddress[]> {
    const addresses = await prisma.clientAddresses.findMany({
      where: { clientId },
      orderBy: [
        { isPrimary: 'desc' }, // Primary addresses first
        { createdAt: 'desc' },
      ],
    })

    return addresses
  }

  /**
   * Create a new address for a client
   *
   * @param addressData - Address information
   * @returns Created address
   */
  async createClientAddress(
    addressData: CreateClientAddressInput,
  ): Promise<ClientAddress> {
    // If this is marked as primary, unmark all other addresses for this client
    if (addressData.isPrimary) {
      await prisma.clientAddresses.updateMany({
        where: { clientId: addressData.clientId, isPrimary: true },
        data: { isPrimary: false },
      })
    }

    const address = await prisma.clientAddresses.create({
      data: {
        clientId: addressData.clientId,
        address: addressData.address,
        branchNumber: addressData.branchNumber || null,
        deliveryOptionName: addressData.deliveryOptionName || null,
        isPrimary: addressData.isPrimary || false,
      },
    })

    console.log(
      `✅ Created address ${address.addressId} for client ${addressData.clientId}`,
    )

    return address
  }

  /**
   * Update an existing client address
   *
   * @param addressId - Address ID to update
   * @param updates - Fields to update
   * @returns Updated address
   */
  async updateClientAddress(
    addressId: string,
    updates: UpdateClientAddressInput,
  ): Promise<ClientAddress> {
    // Check if address exists
    const existingAddress = await prisma.clientAddresses.findUnique({
      where: { addressId },
    })

    if (!existingAddress) {
      throw ErrorFactory.notFound(`Address with ID ${addressId} not found`)
    }

    // If setting as primary, unmark other addresses for this client
    if (updates.isPrimary) {
      await prisma.clientAddresses.updateMany({
        where: {
          clientId: existingAddress.clientId,
          isPrimary: true,
          addressId: { not: addressId },
        },
        data: { isPrimary: false },
      })
    }

    const address = await prisma.clientAddresses.update({
      where: { addressId },
      data: {
        address: updates.address,
        branchNumber: updates.branchNumber,
        deliveryOptionName: updates.deliveryOptionName,
        isPrimary: updates.isPrimary,
      },
    })

    console.log(`✅ Updated address ${addressId}`)

    return address
  }

  /**
   * Delete a client address
   *
   * @param addressId - Address ID to delete
   */
  async deleteClientAddress(addressId: string): Promise<void> {
    const address = await prisma.clientAddresses.findUnique({
      where: { addressId },
    })

    if (!address) {
      throw ErrorFactory.notFound(`Address with ID ${addressId} not found`)
    }

    await prisma.clientAddresses.delete({
      where: { addressId },
    })

    console.log(`🗑️ Deleted address ${addressId}`)
  }
}

export default new ClientService()
