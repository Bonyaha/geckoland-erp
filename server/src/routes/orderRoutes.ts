// server/src/routes/orderRoutes.ts
import { Router } from 'express'
import {
  fetchNewPromOrders,
  getOrders,
  getOrderById,
  syncOrders,
  createCRMOrder,
  updateOrder,
  checkForNewOrders,
} from '../controllers/orders/orderController'
import { manualCheckForNewOrders } from '../controllers/notifications/notificationController'
import { asyncHandler } from '../middleware/asyncHandler'

const router = Router()

// GET /orders - Get all orders with filtering and pagination
router.get('/', asyncHandler(getOrders))

// GET /orders/:orderId - Get specific order by ID
router.get('/:orderId', asyncHandler(getOrderById))

// POST /orders/fetch/prom - Fetch new orders from Prom
router.post('/fetch/prom', asyncHandler(fetchNewPromOrders))

// POST /orders/sync - Manual sync orders from marketplaces
router.post('/sync', asyncHandler(syncOrders))

// POST /orders/manual-check - Manual check for new orders
router.post('/manual-check', asyncHandler(manualCheckForNewOrders))

// POST /api/orders/create-crm - Create manual order from frontend
router.post('/create-crm', asyncHandler(createCRMOrder))

// PATCH /orders/:orderId - Update an existing order
router.patch('/:orderId', asyncHandler(updateOrder))

router.post('/check-new', asyncHandler(checkForNewOrders))

export default router
