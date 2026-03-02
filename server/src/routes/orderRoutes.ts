// server/src/routes/orderRoutes.ts
import { Router } from 'express'
import { validate } from '../middleware/validation'
import {
  fetchNewPromOrders,
  getOrders,
  getCRMOrders,
  getOrderById,
  syncOrders,
  createCRMOrder,
  updateOrder,
  checkForNewOrders,
  syncPaymentStatuses,
} from '../controllers/orders/orderController'
import {
  getOrdersQuerySchema,
  orderIdParamSchema,
  createCRMOrderSchema,
  updateOrderSchema,
  syncOrdersSchema,
} from '../schemas/order.schema'
import { asyncHandler } from '../middleware/asyncHandler'

const router = Router()

// POST /orders/fetch/prom - Fetch new orders from Prom
router.post('/fetch/prom', asyncHandler(fetchNewPromOrders))

// POST /orders/sync - Manual sync orders from marketplaces
router.post('/sync', validate(syncOrdersSchema), asyncHandler(syncOrders))

// POST /orders/check-new - Manual check for new orders
router.post('/check-new', asyncHandler(checkForNewOrders))

// POST /api/orders/create-crm - Create manual order from frontend
router.post(
  '/create-crm',
  validate(createCRMOrderSchema),
  asyncHandler(createCRMOrder)
)
// POST /orders/sync-payment-statuses - Sync payment statuses for UNPAID orders
router.post('/sync-payment-statuses', asyncHandler(syncPaymentStatuses))

// GET /orders - Get all orders with filtering and pagination
router.get('/', validate(getOrdersQuerySchema), asyncHandler(getOrders))

// GET /orders/crm - Get CRM orders specifically
router.get('/crm', asyncHandler(getCRMOrders))

// GET /orders/:orderId - Get specific order by ID
router.get(
  '/:orderId',
  validate(orderIdParamSchema),
  asyncHandler(getOrderById)
)

// PATCH /orders/:orderId - Update an existing order
router.patch(
  '/:orderId',
  validate(updateOrderSchema),
  asyncHandler(updateOrder)
)

export default router
