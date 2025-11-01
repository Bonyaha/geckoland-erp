import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { novaPoshtaService } from './service'
import { OrderStatus } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Map Nova Poshta status to our OrderStatus enum
 */
function mapNovaPoshtaStatusToOrderStatus(
  novaPoshtaStatus: string,
  statusCode: string
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

    console.log('trackingData is: ', trackingData)

    // Get updated statuses from Nova Poshta
    const updatedStatuses = await novaPoshtaService.getTrackingStatuses(
      trackingData
    )
    console.log('updatedStatuses is: ', updatedStatuses)

    // Update orders in database
    let updatedCount = 0
    const updateResults = []

    for (const status of updatedStatuses) {
      const orderData = trackingData.find(
        (o) => o.trackingNumber === status.trackingNumber
      )

      if (!orderData) continue

      try {
        // Map Nova Poshta status to our OrderStatus enum
        const mappedStatus = mapNovaPoshtaStatusToOrderStatus(
          status.status,
          status.statusCode
        )

        // Update order status and tracking details
        if (mappedStatus !== orderData.currentStatus) {
          await prisma.orders.update({
            where: { orderId: orderData.orderId },
            data: {
              status: mappedStatus,
              trackingNumber: status.trackingNumber,
              lastModified: new Date(),
            },
          })

          updatedCount++
          updateResults.push({
            orderId: orderData.orderId,
            orderNumber: orderData.orderNumber,
            trackingNumber: status.trackingNumber,
            status: mappedStatus,
            updated: true,
          })

          console.log(
            `✅ Updated order ${orderData.orderNumber}: ${mappedStatus}`
          )
        } else {
          console.log(
            `ℹ️ Order ${orderData.orderNumber}: Status unchanged (${mappedStatus})`
          )
          updateResults.push({
            orderId: orderData.orderId,
            orderNumber: orderData.orderNumber,
            trackingNumber: status.trackingNumber,
            status: mappedStatus,
            novaPoshtaStatus: status.status,
            updated: false,
            reason: 'Status unchanged',
          })
        }
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
