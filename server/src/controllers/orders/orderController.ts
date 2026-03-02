// server/src/controllers/orders/orderController.ts
import { Request, Response } from 'express'
import OrderService from '../../services/orders/orderService'
import { Source } from '../../config/database'
import { ErrorFactory } from '../../middleware/errorHandler'
import {
  OrderSyncResult,
  CRMOrderCreateInput,
  OrderUpdateInput,
  OrderFilterParams,
  OrderCheckSummary,
  isOrderSource,
  isOrderStatus,
  createOrderFilterParams,
} from '../../types/orders'

const orderService = new OrderService()

/**
 * Fetch new orders from Prom marketplace and create them in database
 */
export const fetchNewPromOrders = async (
  req: Request,
  res: Response
): Promise<void> => {
  console.log('Received request to fetch new Prom orders')

  const result: OrderSyncResult =
    await orderService.fetchAndCreateNewPromOrders()

  // Adjust response based on errors
  const hasErrors = result.errors > 0

  res.status(hasErrors ? 207 : 200).json({
    success: !hasErrors,
    message: hasErrors
      ? `Processed Prom orders with ${result.errors} errors`
      : 'Successfully processed all Prom orders',
    data: result,
  })
}

/**
 * Create new manual order from frontend (CRM)
 * @route POST /api/orders/create-crm
 */
export const createCRMOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  const orderData = req.body as CRMOrderCreateInput

  if (!orderData || Object.keys(orderData).length === 0) {
    throw ErrorFactory.badRequest('Order data is required')
  }

  // Just await the service call - if it throws an AppError, let it bubble up
  // The error middleware will handle it properly
  const result = await orderService.createOrderFromCRM(orderData)

  res.status(201).json({
    success: true,
    message: 'CRM order created successfully',
    orderId: result.orderId,
  })
}

/** Update order by ID
 */

export const updateOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { orderId } = req.params
  const updates = req.body as OrderUpdateInput

  if (!orderId) {
    throw ErrorFactory.badRequest('Order ID is required')
  }

  const updatedOrder = await orderService.updateOrder(orderId, updates)

  if (!updatedOrder) {
    throw ErrorFactory.notFound(`Order with ID ${orderId} not found`)
  }

  res.status(200).json({
    success: true,
    data: updatedOrder,
  })
}

/**
 * Get orders with filtering and pagination
 */
export const getOrders = async (req: Request, res: Response): Promise<void> => {
  const { page, limit, source, status } = req.query

  // Validate source using type guard
  if (source && !isOrderSource(source as string)) {
    throw ErrorFactory.validationError(
      `Invalid source: ${source}. Must be one of: prom, rozetka, crm`
    )
  }

  // Validate status using type guard
  if (status && !isOrderStatus(status as string)) {
    throw ErrorFactory.validationError(
      `Invalid order status: ${status}. Must be a valid order status.`
    )
  }

  // Use the createOrderFilterParams helper for consistent filter creation
  const filterParams = createOrderFilterParams({
    page: page ? parseInt(page as string) : undefined,
    limit: limit ? parseInt(limit as string) : undefined,
    source: source as Source | undefined,
    status: status as string | undefined,
  })

  const result = await orderService.getOrders(filterParams)

  if (!result) {
    throw ErrorFactory.internal('Failed to fetch orders')
  }

  res.status(200).json({
    success: true,
    data: result,
  })
}

/**
 * Get CRM orders specifically for google sheets
 * @route GET /api/orders/crm
 */
export const getCRMOrders = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { page, limit } = req.query

  // Create filter params specifically for CRM orders
  const filterParams = createOrderFilterParams({
    page: page ? parseInt(page as string) : 1,
    limit: limit ? parseInt(limit as string) : 100, // Higher limit for Google Sheets
    source: 'crm' as Source, // Filter only CRM orders
  })

  const result = await orderService.getOrders(filterParams)

  if (!result) {
    throw ErrorFactory.internal('Failed to fetch CRM orders')
  }

  res.status(200).json({
    success: true,
    data: result,
  })
}


/**
 * Get a specific order by ID
 */
export const getOrderById = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { orderId } = req.params
  if (!orderId) {
    throw ErrorFactory.badRequest('Order ID is required')
  }

  const order = await orderService.getOrderById(orderId)

  if (!order) {
    throw ErrorFactory.notFound(`Order with ID ${orderId} not found`)
  }

  res.status(200).json({
    success: true,
    data: order,
  })
}

/**
 * Manual trigger to sync orders from all marketplaces
 */
export const syncOrders = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { marketplace } = req.body
  if (marketplace && marketplace !== 'prom') {
    throw ErrorFactory.badRequest(
      'Invalid marketplace. Currently only "prom" is supported.'
    )
  }

  const result = await orderService.fetchAndCreateNewPromOrders()

  if (!result) {
    throw ErrorFactory.internal('Failed to sync orders')
  }

  res.status(200).json({
    success: true,
    message: `Successfully synced orders from ${marketplace || 'prom'}`,
    data: result,
  })
}

export const checkForNewOrders = async (
  req: Request,
  res: Response
): Promise<void> => {
  const summary: OrderCheckSummary =
    await orderService.manualCheckForNewOrders()
  if (!summary) {
    throw ErrorFactory.internal('Failed to check for new orders')
  }
  res.status(200).json(summary)
}

/**
 * Sync payment statuses for all UNPAID Prom/Rozetka orders
 * @route POST /api/orders/sync-payment-statuses
 */
export const syncPaymentStatuses = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await orderService.syncUnpaidOrdersPaymentStatus()

  res.status(200).json({
    success: true,
    message: `Payment sync complete: ${result.updated} updated out of ${result.checked} checked`,
    data: result,
  })
}
