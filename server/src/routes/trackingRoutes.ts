// server/src/routes/trackingRoutes.ts
import { Router } from 'express';
import {
  updateOrderTrackingStatuses,
  getSingleOrderTracking,
  updateOrderTrackingNumber,
} from '../controllers/orders/orderTrackingController';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// Update all order tracking statuses
router.post('/update-all', asyncHandler(updateOrderTrackingStatuses))

// Get tracking status for a single order
router.get('/order/:orderId', asyncHandler(getSingleOrderTracking))

// Update tracking status for a single order (NEW)
router.patch('/order/:orderId', asyncHandler(updateOrderTrackingNumber))

export default router;