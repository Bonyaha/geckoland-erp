// server/src/controllers/orders/orderTrackingController.ts
import { Request, Response } from 'express'
import prisma from '../../config/database'
import { novaPoshtaService } from '../../services/delivery/novaPoshtaService'
import { OrderStatus } from '@prisma/client'
import { ErrorFactory, AppError } from '../../middleware/errorHandler'
import {
  OrderTrackingUpdateRequest,
  OrderTrackingResult,
} from '../../types/orders'
import SalesService from '../../services/sales/salesService'
import OrderService from '../../services/orders/orderService'
import { trackingService } from '../../services/tracking/trackingService'

const salesService = new SalesService()
const orderService = new OrderService()

/**
 * Map Nova Poshta status to our OrderStatus enum
 */
function mapNovaPoshtaStatusToOrderStatus(
  novaPoshtaStatus: string,
  statusCode: string,
): OrderStatus {
  const status = novaPoshtaStatus.toLowerCase()

  // Delivered statuses
  if (
    status.includes('одержано') ||
    status.includes('отримано') ||
    status.includes('delivered') ||
    status.includes('получено') ||
    statusCode === '9'
  ) {
    return OrderStatus.DELIVERED
  }

  // Shipped/In transit statuses
  if (
    status.includes('прямує') ||
    status.includes('відправлено') ||
    status.includes('в дорозі') ||
    status.includes('shipped') ||
    status.includes('в пути') ||
    statusCode === '6' ||
    statusCode === '7'
  ) {
    return OrderStatus.SHIPPED
  }

  // Awaiting pickup at warehouse
  if (
    status.includes('прибув') ||
    status.includes('очікує') ||
    status.includes('готове до видачі') ||
    status.includes('awaiting') ||
    status.includes('arrived') ||
    statusCode === '8'
  ) {
    return OrderStatus.AWAITING_PICKUP
  }

  // Canceled/Refused
  if (
    status.includes('відмова') ||
    status.includes('скасовано') ||
    status.includes('refused') ||
    status.includes('canceled') ||
    statusCode === '102' ||
    statusCode === '103'
  ) {
    return OrderStatus.CANCELED
  }

  // Return
  if (
    status.includes('повернення') ||
    status.includes('return') ||
    statusCode === '10'
  ) {
    return OrderStatus.RETURN
  }

  // Prepared (order created, preparing for shipment)
  if (
    status.includes('оброблено') ||
    status.includes('створено') ||
    status.includes('зареєстровано') ||
    status.includes('created') ||
    status.includes('registered') ||
    statusCode === '1' ||
    statusCode === '2' ||
    statusCode === '3'
  ) {
    return OrderStatus.PREPARED
  }

  // Default to RECEIVED for unknown statuses
  return OrderStatus.RECEIVED
}

//This controller has to be revised and modified according to my shema (tracking numbers and statuses are the main point here)

export const updateOrderTrackingStatuses = async (
  req: Request,
  res: Response,
) => {
  try {
    console.log('🔄 Starting order tracking status update...')

    // Call the shared tracking service with '[API]' prefix for logs
    const summary = await trackingService.updateAllTrackingStatuses('[API]')

    if (summary.totalChecked === 0) {
      throw ErrorFactory.notFound('No orders to update')
    }

    res.json({
      success: true,
      message: `Updated ${summary.updated} out of ${summary.totalChecked} orders`,
      updated: summary.updated,
      total: summary.totalChecked,
      unchanged: summary.unchanged,
      errors: summary.errors,
      duration: summary.duration,
    })
  } catch (error: any) {
    if (error instanceof AppError) throw error
    throw ErrorFactory.internal('Failed to update tracking statuses')
  }
}

/**
 * Get tracking status for a single order
 * 
 * @route GET /api/tracking/order/:orderId
 */
export const getSingleOrderTracking = async (req: Request, res: Response) => {
  const { orderId } = req.params as { orderId: string }

  try {
    const trackingResult = await trackingService.getSingleOrderTracking(orderId)

    res.json({
      success: true,
      data: trackingResult,
    })
  } catch (error: any) {
    if (error.message === 'Order not found') {
      throw ErrorFactory.notFound('Order not found')
    }
    if (error.message === 'No tracking number found for this order') {
      throw ErrorFactory.badRequest('No tracking number found for this order')
    }
    if (error.message === 'Tracking information not found') {
      throw ErrorFactory.notFound('Tracking information not found')
    }
    throw ErrorFactory.internal('Failed to get tracking status')
  }
}

/**
 * Update order tracking number
 * Supports TWO modes:
 * 1. Manual update: Provide trackingNumber in body
 * 2. Automatic fetch: Leave body empty to fetch from marketplace
 *
 * @route PATCH /api/tracking/order/:orderId
 */
export const updateOrderTrackingNumber = async (
  req: Request,
  res: Response,
) => {
  const { orderId } = req.params as { orderId: string }
  const { trackingNumber } = req.body

  if (!orderId) {
    throw ErrorFactory.badRequest('Order ID is required')
  }

  // MODE 1: Manual tracking number update (EXISTING BEHAVIOR)
  if (trackingNumber && typeof trackingNumber === 'string') {
    const updatedOrder = await orderService.updateOrder(orderId, {
      trackingNumber: trackingNumber.trim(),
    })

    return res.json({
      success: true,
      message: 'Tracking number updated successfully',
      data: {
        orderId: updatedOrder.orderId,
        orderNumber: updatedOrder.orderNumber,
        trackingNumber: updatedOrder.trackingNumber,
        status: updatedOrder.status,
      },
    })
  }

  // MODE 2: Automatic fetch from marketplace (NEW BEHAVIOR)
  console.log(`🔄 Fetching tracking from marketplace for order: ${orderId}`)

  try {
    const result = await orderService.fetchAndUpdateTrackingNumber(orderId)

    // Already has tracking
    if (result.alreadyExists) {
      return res.status(200).json({
        success: true,
        message: 'Order already has a tracking number',
        data: {
          orderId: result.orderId,
          trackingNumber: result.trackingNumber,
        },
      })
    }

    // Not yet available on marketplace
    if (result.notYetAvailable) {
      return res.status(200).json({
        success: false,
        message: 'Tracking number not yet available on marketplace',
        data: {
          orderId: result.orderId,
          trackingNumber: null,
        },
      })
    }

    // Success - tracking fetched
    res.status(200).json({
      success: true,
      message: 'Tracking number fetched successfully',
      data: {
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        trackingNumber: result.trackingNumber,
      },
    })
  } catch (error: any) {
    if (error instanceof AppError) throw error
    throw ErrorFactory.internal('Failed to fetch tracking number')
  }
}
