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
  createClient,
  getClients,
  getClientById,
  updateClient,
  searchClientByPhone,
  getOrCreateClient,
} from '../controllers/clients/clientController'

const router = Router()

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

/**
 * @route   GET /api/clients/search/phone
 * @desc    Search clients by phone number
 * @access  Private
 * @query   phone - Phone number to search for
 */
router.get('/search/phone', asyncHandler(searchClientByPhone))

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
 * @route   PATCH /api/clients/:clientId
 * @desc    Update an existing client
 * @access  Private
 */
router.patch(
  '/:clientId',
  validate(updateClientSchema),
  asyncHandler(updateClient),
)

export default router
