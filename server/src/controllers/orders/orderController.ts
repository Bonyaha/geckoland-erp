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

  const orderId = await orderService.createOrderFromCRM(orderData)

  if (!orderId) {
    // preserve custom error message
    throw ErrorFactory.internal('Failed to create CRM order')
  }
  res.status(201).json({
    message: 'CRM order created successfully',
    orderId,
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

  const params: OrderFilterParams = {}
  if (page) params.page = parseInt(page as string)
  if (limit) params.limit = parseInt(limit as string)
  if (source && (source === 'prom' || source === 'rozetka')) {
    params.source = source as Source
  }
  if (status) params.status = status as string

  const result = await orderService.getOrders(params)
  if (!result) {
    throw ErrorFactory.internal('Failed to fetch orders')
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
