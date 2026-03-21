// server/src/routes/clientRoutes.ts
import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler'
import { validate } from '../middleware/validation'
import {
  createClientSchema,
  updateClientSchema,
  getClientsQuerySchema,
  getClientByIdSchema,
} from '../schemas/client.schema'

import {
  createClientAddressSchema,
  updateClientAddressSchema,
  getClientAddressesSchema,
  deleteClientAddressSchema,
} from '../schemas/clientAddress.schema'

import {
  createClient,
  getClients,
  getClientById,
  updateClient,  
  getOrCreateClient,
} from '../controllers/clients/clientController'

import {
  getClientAddresses,
  createClientAddress,
  updateClientAddress,
  deleteClientAddress,
} from '../controllers/clients/clientAddressController'

const router = Router()

// POST routes
/**
 * @route   POST /api/clients
 * @desc    Create a new client
 * @access  Private
 */
router.post('/', validate(createClientSchema), asyncHandler(createClient))

/**
 * @route   POST /api/clients/get-or-create
 * @desc    Get existing client or create new one (useful for order creation)
 * @access  Private
 */
router.post(
  '/get-or-create',
  validate(createClientSchema),
  asyncHandler(getOrCreateClient),
)

// GET routes
/**
 * @route   GET /api/clients
 * @desc    Get all clients with optional search and pagination
 * @access  Private
 * @query   search - Search term (optional)
 * @query   page - Page number (optional, default: 1)
 * @query   limit - Items per page (optional, default: 20)
 */
router.get('/', validate(getClientsQuerySchema), asyncHandler(getClients))

/**
 * @route   GET /api/clients/:clientId
 * @desc    Get a single client by ID
 * @access  Private
 */
router.get(
  '/:clientId',
  validate(getClientByIdSchema),
  asyncHandler(getClientById),
)

/**
 * @route   GET /api/clients/:clientId/addresses
 * @desc    Get all addresses for a client
 * @access  Private
 */
router.get(
  '/:clientId/addresses',
  validate(getClientAddressesSchema),
  asyncHandler(getClientAddresses),
)
 
/**
 * @route   POST /api/clients/:clientId/addresses
 * @desc    Create a new address for a client
 * @access  Private
 */
router.post(
  '/:clientId/addresses',
  validate(createClientAddressSchema),
  asyncHandler(createClientAddress),
)

// PATCH routes
/**
 * @route   PATCH /api/clients/:clientId
 * @desc    Update an existing client
 * @access  Private
 */
router.patch(
  '/:clientId',
  validate(updateClientSchema),
  asyncHandler(updateClient),
)

/**
 * @route   PATCH /api/addresses/:addressId
 * @desc    Update a client address
 * @access  Private
 */
router.patch(
  '/addresses/:addressId',
  validate(updateClientAddressSchema),
  asyncHandler(updateClientAddress),
)
 
// CHANGE: Address delete route
/**
 * @route   DELETE /api/addresses/:addressId
 * @desc    Delete a client address
 * @access  Private
 */
router.delete(
  '/addresses/:addressId',
  validate(deleteClientAddressSchema),
  asyncHandler(deleteClientAddress),
)

export default router
