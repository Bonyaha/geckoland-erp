// server/src/routes/orderRoutes.ts
import { Router } from 'express'
import {
  fetchNewPromOrders,
  getOrders,
  getOrderById,
  syncOrders,
  createCRMOrder,
  updateOrder,
} from '../controllers/orderController'
import { manualCheckForNewOrders } from '../controllers/notificationController'

const router = Router()

// GET /orders - Get all orders with filtering and pagination
router.get('/', getOrders)

// GET /orders/:orderId - Get specific order by ID
router.get('/:orderId', getOrderById)

// POST /orders/fetch/prom - Fetch new orders from Prom
router.post('/fetch/prom', fetchNewPromOrders)

// POST /orders/sync - Manual sync orders from marketplaces
router.post('/sync', syncOrders)

// POST /orders/manual-check - Manual check for new orders
router.post('/manual-check', manualCheckForNewOrders)

// POST /api/orders/create-crm - Create manual order from frontend
router.post('/create-crm', createCRMOrder)

// PATCH /orders/:orderId - Update an existing order
router.patch('/:orderId', updateOrder)


export default router
