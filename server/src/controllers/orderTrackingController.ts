import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { novaPoshtaService } from '../services/delivery/novaPoshtaService'
import { OrderStatus } from '@prisma/client'

const prisma = new PrismaClient()

//This controller has to be revised and modified according to my shema (tracking numbers and statuses are the main point here)

export const updateOrderTrackingStatuses = async (
  req: Request,
  res: Response
) => {
  try {
    console.log('🔄 Starting order tracking status update...')

    // Fetch all orders that have tracking numbers and are not delivered
    const orders = await prisma.orders.findMany({
      where: {
        AND: [
          // Has a tracking number
          {
            trackingNumber: {
              not: null,
            },
          },
          // Not in final status
          {
            status: {
              notIn: [
                OrderStatus.DELIVERED,
                OrderStatus.CANCELED,
                OrderStatus.RETURN,
              ],
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
      res.json({
        success: true,
        message: 'No orders to update',
        updated: 0,
      })
      return
    }

    console.log(`📦 Found ${orders.length} orders to check`)

    // Extract tracking data from orders
    const trackingData = orders
      .map((order) => {
        if (!order.trackingNumber) return null

        return {
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          trackingNumber: order.trackingNumber,
          phoneNumber: order.recipientPhone || order.clientPhone || '',
          currentStatus: order.status,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

    if (trackingData.length === 0) {
      res.json({
        success: true,
        message: 'No valid tracking numbers found',
        updated: 0,
      })
      return
    }

    // Get updated statuses from Nova Poshta
    const updatedStatuses = await novaPoshtaService.getTrackingStatuses(
      trackingData
    )

    // Update orders in database
    let updatedCount = 0
    const updateResults = []

    for (const status of updatedStatuses) {
      const orderData = trackingData.find(
        (o) => o.trackingNumber === status.trackingNumber
      )

      if (!orderData) continue

      try {
        // Update order status and tracking details
        await prisma.orders.update({
          where: { orderId: orderData.orderId },
          data: {
            status: status.status
              ? OrderStatus[status.status as keyof typeof OrderStatus]
              : orderData.currentStatus,
            trackingNumber: status.trackingNumber,
            lastModified: new Date(),
          },
        })

        updatedCount++
        updateResults.push({
          orderId: orderData.orderId,
          orderNumber: orderData.orderNumber,
          trackingNumber: status.trackingNumber,
          status: status.status,
          updated: true,
        })

        console.log(
          `✅ Updated order ${orderData.orderNumber}: ${status.status}`
        )
      } catch (error: any) {
        console.error(
          `❌ Failed to update order ${orderData.orderId}:`,
          error.message
        )
        updateResults.push({
          orderId: orderData.orderId,
          orderNumber: orderData.orderNumber,
          trackingNumber: status.trackingNumber,
          error: error.message,
          updated: false,
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
      `✅ Tracking update complete: ${updatedCount}/${trackingData.length} orders updated`
    )
  } catch (error: any) {
    console.error('❌ Error updating tracking statuses:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}

export const getSingleOrderTracking = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params

    const order = await prisma.orders.findUnique({
      where: { orderId },
      select: {
        orderId: true,
        orderNumber: true,
        clientPhone: true,
        recipientPhone: true,
        deliveryProviderData: true,
        deliveryAddress: true,
      },
    })

    if (!order) {
      res.status(404).json({
        success: false,
        error: 'Order not found',
      })
      return
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
      res.status(400).json({
        success: false,
        error: 'No tracking number found for this order',
      })
      return
    }

    // Get tracking status
    const phoneNumber = order.recipientPhone || order.clientPhone || ''
    const trackingStatus = await novaPoshtaService.getSingleTrackingStatus(
      trackingNumber,
      phoneNumber
    )

    if (!trackingStatus) {
      res.status(404).json({
        success: false,
        error: 'Tracking information not found',
      })
      return
    }

    res.json({
      success: true,
      data: trackingStatus,
    })
  } catch (error: any) {
    console.error('❌ Error fetching tracking status:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}
