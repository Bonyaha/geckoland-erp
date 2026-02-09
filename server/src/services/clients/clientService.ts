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
} from '../../types/clients'

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
        deliveryOptionName: clientData.deliveryOptionName || null,
        paymentOptionName: clientData.paymentOptionName || null,
        reliability: clientData.reliability || null,
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
      if (updates.deliveryOptionName !== undefined)
        updateData.deliveryOptionName = updates.deliveryOptionName || null
      if (updates.paymentOptionName !== undefined)
        updateData.paymentOptionName = updates.paymentOptionName || null
      if (updates.reliability !== undefined)
        updateData.reliability = updates.reliability || null

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
}

export default new ClientService()
