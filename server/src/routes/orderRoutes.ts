// server/src/routes/orderRoutes.ts
import { Router } from 'express'
import {
  fetchNewPromOrders,
  getOrders,
  getOrderById,
  syncOrders,
} from '../controllers/orderController'

const router = Router()

// GET /orders - Get all orders with filtering and pagination
router.get('/', getOrders)

// GET /orders/:orderId - Get specific order by ID
router.get('/:orderId', getOrderById)

// POST /orders/fetch/prom - Fetch new orders from Prom
router.post('/fetch/prom', fetchNewPromOrders)

// POST /orders/sync - Manual sync orders from marketplaces
router.post('/sync', syncOrders)

export default router
