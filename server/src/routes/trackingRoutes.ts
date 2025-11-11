// server/src/routes/trackingRoutes.ts
import { Router } from 'express';
import {
  updateOrderTrackingStatuses,
  getSingleOrderTracking,
} from '../controllers/orders/orderTrackingController';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// Update all order tracking statuses
router.post('/update-all', asyncHandler(updateOrderTrackingStatuses))

// Get tracking status for a single order
router.get('/order/:orderId', asyncHandler(getSingleOrderTracking))

export default router;