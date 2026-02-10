// server/src/controllers/orders/orderTrackingController.ts
import { Request, Response } from 'express'
import prisma from '../../config/database'
import { novaPoshtaService } from '../../services/delivery/novaPoshtaService'
import { OrderStatus } from '@prisma/client'
import { ErrorFactory } from '../../middleware/errorHandler'
import {
  OrderTrackingUpdateRequest,
  OrderTrackingResult,
} from '../../types/orders'
import SalesService from '../../services/sales/salesService'
import OrderService from '../../services/orders/orderService'

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
  console.log('🔄 Starting order tracking status update...')

  // Fetch all orders that have tracking numbers and are not delivered
  const orders = await prisma.orders.findMany({
    where: {
      AND: [
        // Has a tracking number
        {
          trackingNumber: {
            not: {
              equals: null,
            },
          },
        },
        {
          trackingNumber: {
            not: {
              equals: '',
            },
          },
        },
        // Not in final status
        {
          status: {
            notIn: ['DELIVERED', 'CANCELED', 'RETURN'],
          },
        },
      ],
    },
    select: {
      orderId: true,
      orderNumber: true,
      status: true,
      clientPhone: true,
      recipientPhone: true,
      trackingNumber: true,
    },
  })

  if (orders.length === 0) {
    throw ErrorFactory.notFound('No orders to update')
  }

  console.log(`Found ${orders.length} orders to check`)

  // Extract tracking data from orders
  const rawTrackingData = orders.map((order) => {
    if (!order.trackingNumber) return null

    // Convert Prisma null to undefined for strict TS compliance with interface
    const mappedRequest: OrderTrackingUpdateRequest = {
      orderId: order.orderId,
      orderNumber: order.orderNumber || undefined, // Fix: converts null to undefined
      trackingNumber: order.trackingNumber,
      phoneNumber: order.recipientPhone || order.clientPhone || '',
      currentStatus: order.status,
    }
    return mappedRequest
  })

  // FIX: Filter nulls and narrow type correctly
  const trackingData: OrderTrackingUpdateRequest[] = rawTrackingData.filter(
    (item): item is OrderTrackingUpdateRequest => item !== null,
  )

  if (trackingData.length === 0) {
    throw ErrorFactory.notFound('No valid tracking numbers found')
  }

  console.log('trackingData is: ', trackingData)

  // Get updated statuses from Nova Poshta
  const updatedStatuses =
    await novaPoshtaService.getTrackingStatuses(trackingData)
  console.log('updatedStatuses is: ', updatedStatuses)

  // Update orders in database
  let updatedCount = 0
  const updateResults: OrderTrackingResult[] = []

  for (const status of updatedStatuses) {
    const orderData = trackingData.find(
      (o) => o.trackingNumber === status.trackingNumber,
    )

    if (!orderData) continue

    try {
      // Map Nova Poshta status to our OrderStatus enum
      const mappedStatus = mapNovaPoshtaStatusToOrderStatus(
        status.status,
        status.statusCode,
      )

      // Update order status and tracking details
      if (mappedStatus !== orderData.currentStatus) {
        await orderService.updateOrder(orderData.orderId, {
          status: mappedStatus,
          trackingNumber: status.trackingNumber,
        })

        updatedCount++        

        // Create typed tracking result
        updateResults.push({
          orderId: orderData.orderId,
          orderNumber: orderData.orderNumber,
          trackingNumber: status.trackingNumber,
          newStatus: mappedStatus,
          statusDetails: {
            novaPoshtaStatus: status.status,
            statusCode: status.statusCode,
            previousStatus: orderData.currentStatus,
          },
          updatedAt: new Date(),
          updated: true,
        })

        console.log(
          `✅ Updated order ${orderData.orderNumber}: ${mappedStatus}`,
        )
      } else {
        console.log(
          `ℹ️ Order ${orderData.orderNumber}: Status unchanged (${mappedStatus})`,
        )

        // Still add to results for transparency
        updateResults.push({
          orderId: orderData.orderId,
          orderNumber: orderData.orderNumber,
          trackingNumber: status.trackingNumber,
          newStatus: mappedStatus,
          statusDetails: {
            novaPoshtaStatus: status.status,
            statusCode: status.statusCode,
            unchanged: true,
          },
          updatedAt: new Date(),
          updated: false,
          reason: 'Status unchanged',
        })
      }
    } catch (error: any) {
      console.error(
        `❌ Failed to update order ${orderData.orderId}:`,
        error.message,
      )
      // Add error to results
      updateResults.push({
        orderId: orderData.orderId,
        orderNumber: orderData.orderNumber,
        trackingNumber: status.trackingNumber,
        newStatus: orderData.currentStatus as OrderStatus,
        statusDetails: {
          error: error.message,
          novaPoshtaStatus: status.status,
        },
        updatedAt: new Date(),
        updated: false,
        error: error.message,
      })
    }
  }

  res.json({
    success: true,
    message: `Updated ${updatedCount} out of ${trackingData.length} orders`,
    updated: updatedCount,
    total: trackingData.length,
    results: updateResults,
  })

  console.log(
    `✅ Tracking update complete: ${updatedCount}/${trackingData.length} orders updated`,
  )
}

/**
 * Get tracking status for a single order
 */
export const getSingleOrderTracking = async (req: Request, res: Response) => {
  const { orderId } = req.params

  const order = await prisma.orders.findUnique({
    where: { orderId },
    select: {
      orderId: true,
      orderNumber: true,
      status: true,
      clientPhone: true,
      recipientPhone: true,
      deliveryProviderData: true,
      deliveryAddress: true,
    },
  })

  if (!order) {
    throw ErrorFactory.notFound('Order not found')
  }

  // Extract tracking number
  let trackingNumber = ''
  if (
    order.deliveryProviderData &&
    typeof order.deliveryProviderData === 'object'
  ) {
    const data = order.deliveryProviderData as any
    trackingNumber = data.trackingNumber || data.ttn || ''
  }

  if (!trackingNumber && order.deliveryAddress) {
    const ttnMatch = order.deliveryAddress.match(/ТТН[:\s]*(\d+)/i)
    if (ttnMatch) {
      trackingNumber = ttnMatch[1]
    }
  }

  if (!trackingNumber) {
    throw ErrorFactory.badRequest('No tracking number found for this order')
  }

  // Get tracking status
  const phoneNumber = order.recipientPhone || order.clientPhone || ''
  const novaPoshtaStatus = await novaPoshtaService.getSingleTrackingStatus(
    trackingNumber,
    phoneNumber,
  )

  if (!novaPoshtaStatus) {
    throw ErrorFactory.notFound('Tracking information not found')
  }
  // Map to our status and create tracking result
  const mappedStatus = mapNovaPoshtaStatusToOrderStatus(
    novaPoshtaStatus.status,
    novaPoshtaStatus.statusCode,
  )

  const trackingResult: OrderTrackingResult = {
    orderId: order.orderId,
    trackingNumber,
    newStatus: mappedStatus,
    statusDetails: {
      novaPoshtaStatus: novaPoshtaStatus.status,
      statusCode: novaPoshtaStatus.statusCode,
      currentOrderStatus: order.status,
      statusChanged: mappedStatus !== order.status,
      rawData: novaPoshtaStatus,
    },
    updatedAt: new Date(),
  }

  res.json({
    success: true,
    data: trackingResult,
  })
}

/**
 * Update tracking number for an existing order
 * This can be called from frontend to manually set/update tracking number
 */
export const updateOrderTrackingNumber = async (
  req: Request,
  res: Response,
) => {
  const { orderId } = req.params
  const { trackingNumber } = req.body

  if (!trackingNumber || typeof trackingNumber !== 'string') {
    throw ErrorFactory.badRequest('Valid tracking number is required')
  }

  // Update order with new tracking number
  const updatedOrder = await orderService.updateOrder(orderId, {
    trackingNumber: trackingNumber.trim(),
  })

  res.json({
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
