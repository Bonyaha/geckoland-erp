// server/src/routes/sales.routes.ts
import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler'
import {
  backfillSales,
  createSalesForOrder,
  getSalesStats,
  checkSalesHealth,
  getProductsSalesData,
} from '../controllers/sales/salesController'

const router = Router()

/**
 * @route   POST /api/sales/backfill
 * @desc    Backfill sales records for all existing delivered orders (one-time migration)
 * @access  Private (should be protected by authentication)
 */
router.post('/backfill', asyncHandler(backfillSales))

/**
 * @route   POST /api/sales/create/:orderId
 * @desc    Manually create sales records for a specific order
 * @access  Private
 */
router.post('/create/:orderId', asyncHandler(createSalesForOrder))

/**
 * @route   GET /api/sales/stats
 * @desc    Get sales statistics for a date range
 * @access  Private
 * @query   startDate - ISO date string (e.g., 2024-01-01)
 * @query   endDate - ISO date string (e.g., 2024-12-31)
 */
router.get('/stats', asyncHandler(getSalesStats))

/**
 * @route   GET /api/sales/health
 * @desc    Health check - verify sales records are being created for recent delivered orders
 * @access  Private
 */
router.get('/health', asyncHandler(checkSalesHealth))

/**
 * @route   POST /api/sales/products
 * @desc    Get aggregated sales data for multiple products
 * @access  Private
 * @body    productIds - Array of product IDs
 */
router.post('/products', asyncHandler(getProductsSalesData))

export default router
