import { Router } from 'express'
import {
  updateOrderTrackingStatuses,
  getSingleOrderTracking,
} from './controller'

const router = Router()

// Update all order tracking statuses
router.post('/update-all', updateOrderTrackingStatuses)

// Get tracking status for a single order
router.get('/order/:orderId', getSingleOrderTracking)

export default router
