// server/src/controllers/clients/clientAddressController.ts

import { Request, Response } from 'express'
import clientService from '../../services/clients/clientService'
import { ErrorFactory } from '../../middleware/errorHandler'
import {
  CreateClientAddressInput,
  UpdateClientAddressInput,
} from '../../types/clientAddresses'

/**
 * Get all addresses for a client
 * @route GET /api/clients/:clientId/addresses
 */
export const getClientAddresses = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { clientId } = req.params

  if (!clientId) {
    throw ErrorFactory.badRequest('Client ID is required')
  }

  const addresses = await clientService.getClientAddresses(clientId)

  res.status(200).json({
    success: true,
    data: addresses,
  })
}

/**
 * Create a new address for a client
 * @route POST /api/clients/:clientId/addresses
 */
export const createClientAddress = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { clientId } = req.params
  const addressData: Omit<CreateClientAddressInput, 'clientId'> = req.body

  if (!clientId) {
    throw ErrorFactory.badRequest('Client ID is required')
  }

  const address = await clientService.createClientAddress({
    ...addressData,
    clientId,
  })

  res.status(201).json({
    success: true,
    message: 'Address created successfully',
    data: address,
  })
}

/**
 * Update an existing client address
 * @route PATCH /api/addresses/:addressId
 */
export const updateClientAddress = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { addressId } = req.params
  const updates: UpdateClientAddressInput = req.body

  if (!addressId) {
    throw ErrorFactory.badRequest('Address ID is required')
  }

  const address = await clientService.updateClientAddress(addressId, updates)

  res.status(200).json({
    success: true,
    message: 'Address updated successfully',
    data: address,
  })
}

/**
 * Delete a client address
 * @route DELETE /api/addresses/:addressId
 */
export const deleteClientAddress = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { addressId } = req.params

  if (!addressId) {
    throw ErrorFactory.badRequest('Address ID is required')
  }

  await clientService.deleteClientAddress(addressId)

  res.status(200).json({
    success: true,
    message: 'Address deleted successfully',
  })
}
