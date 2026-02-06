// server/src/controllers/clients/clientController.ts
import { Request, Response } from 'express'
import clientService from '../../services/clients/clientService'
import { ErrorFactory } from '../../middleware/errorHandler'
import {
  CreateClientInput,
  UpdateClientInput,
  ClientFilterParams,
} from '../../types/clients'

/**
 * Create a new client
 * @route POST /api/clients
 */
export const createClient = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const clientData: CreateClientInput = req.body

  const result = await clientService.createClient(clientData)

  res.status(201).json({
    success: true,
    message: result.message,
    clientId: result.clientId,
  })
}

/**
 * Get all clients with optional search and pagination
 * @route GET /api/clients
 */
export const getClients = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const queryParams: ClientFilterParams = {
    search: req.query.search as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
  }

  const result = await clientService.getClients(queryParams)

  res.status(200).json({
    success: true,
    data: result,
  })
}

/**
 * Get a single client by ID
 * @route GET /api/clients/:clientId
 */
export const getClientById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { clientId } = req.params

  if (!clientId) {
    throw ErrorFactory.badRequest('Client ID is required')
  }

  const client = await clientService.getClientById(clientId)

  res.status(200).json({
    success: true,
    data: client,
  })
}

/**
 * Update an existing client
 * @route PATCH /api/clients/:clientId
 */
export const updateClient = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { clientId } = req.params
  const updates: UpdateClientInput = req.body

  if (!clientId) {
    throw ErrorFactory.badRequest('Client ID is required')
  }

  const result = await clientService.updateClient(clientId, updates)

  res.status(200).json({
    success: true,
    message: result.message,
  })
}

/**
 * Search clients by phone number
 * @route GET /api/clients/search/phone
 */
export const searchClientByPhone = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { phone } = req.query

  if (!phone || typeof phone !== 'string') {
    throw ErrorFactory.badRequest('Phone number is required')
  }

  const clients = await clientService.searchByPhone(phone)

  res.status(200).json({
    success: true,
    data: clients,
  })
}

/**
 * Get or create a client (useful for order creation)
 * @route POST /api/clients/get-or-create
 */
export const getOrCreateClient = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const clientData: CreateClientInput = req.body

  const client = await clientService.getOrCreateClient(clientData)

  res.status(200).json({
    success: true,
    data: client,
  })
}
