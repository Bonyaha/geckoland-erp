// server/src/services/tracking/trackingService.ts
import prisma, { OrderStatus } from '../../config/database'
import { novaPoshtaService } from '../delivery/novaPoshtaService'
import {
  OrderTrackingUpdateRequest,
  OrderTrackingResult,
} from '../../types/orders'
import OrderService from '../orders/orderService'
import { mapNovaPoshtaStatusToOrderStatus } from '../../utils/trackingUtils'

const orderService = new OrderService()

/**
 * Shared Tracking Service
 * Contains core business logic for tracking status updates
 * Used by both:
 * - Controller (manual frontend button)
 * - Cron job (automated background updates)
 */
class TrackingService {
  /**
   * Update tracking statuses for all eligible orders
   *
   * This is the core business logic that:
   * 1. Fetches orders with tracking numbers (not in final status)
   * 2. Calls Nova Poshta API to get current statuses
   * 3. Maps Nova Poshta statuses to our OrderStatus enum
   * 4. Updates orders in database if status changed
   *
   * @param logPrefix - Prefix for console logs (e.g., '[CRON]' or '[API]')
   * @returns Summary of the update operation
   */
  async updateAllTrackingStatuses(logPrefix: string = '') {
    const startTime = Date.now()
    console.log(`${logPrefix} 🔄 Starting tracking status update...`)

    try {
      // Fetch all orders that have tracking numbers and are not in final status
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
        console.log(`${logPrefix} ℹ️  No orders to update`)
        return {
          totalChecked: 0,
          updated: 0,
          unchanged: 0,
          errors: 0,
          duration: Date.now() - startTime,
          results: [],
        }
      }

      console.log(`${logPrefix} 📦 Found ${orders.length} orders to check`)

      // Extract tracking data from orders
      const trackingData: OrderTrackingUpdateRequest[] = orders
        .map((order) => {
          if (!order.trackingNumber) return null

          return {
            orderId: order.orderId,
            orderNumber: order.orderNumber || undefined,
            trackingNumber: order.trackingNumber,
            phoneNumber: order.recipientPhone || order.clientPhone || '',
            currentStatus: order.status,
          } as OrderTrackingUpdateRequest
        })
        .filter((item): item is OrderTrackingUpdateRequest => item !== null)

      if (trackingData.length === 0) {
        console.log(`${logPrefix} ⚠️  No valid tracking numbers found`)
        return {
          totalChecked: 0,
          updated: 0,
          unchanged: 0,
          errors: 0,
          duration: Date.now() - startTime,
          results: [],
        }
      }

      console.log(
        `${logPrefix} 🔍 Checking ${trackingData.length} tracking numbers`,
      )

      // Get updated statuses from Nova Poshta
      const updatedStatuses =
        await novaPoshtaService.getTrackingStatuses(trackingData)

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

          // Guard: if Nova Poshta reports statusCode '1'
          // ("Відправник самостійно створив цю накладну, але ще не надав до відправки")
          // and the order is already in RECEIVED (Прийнято) or PREPARED (Зібрано),
          // do NOT downgrade/change the status — leave it as-is.
          const isNovaPoshtaNotYetShipped = status.statusCode === '1'
          const isOrderInEarlyStage =
            orderData.currentStatus === OrderStatus.RECEIVED ||
            orderData.currentStatus === OrderStatus.PREPARED

          if (isNovaPoshtaNotYetShipped && isOrderInEarlyStage) {
            /* console.log(
              `${logPrefix} ⏭️  Skipping order ${orderData.orderNumber}: Nova Poshta statusCode=1 but order is already '${orderData.currentStatus}' — preserving current status`,
            ) */
            updateResults.push({
              orderId: orderData.orderId,
              orderNumber: orderData.orderNumber,
              trackingNumber: status.trackingNumber,
              newStatus: orderData.currentStatus as OrderStatus,
              statusDetails: {
                novaPoshtaStatus: status.status,
                statusCode: status.statusCode,
                unchanged: true,
                skippedReason:
                  'Nova Poshta statusCode=1 does not override RECEIVED/PREPARED',
              },
              updatedAt: new Date(),
              updated: false,
              reason: 'Status unchanged',
            })
            continue
          }

          // Update order status if it changed
          if (mappedStatus !== orderData.currentStatus) {
            await orderService.updateOrder(orderData.orderId, {
              status: mappedStatus,
              trackingNumber: status.trackingNumber,
            })

            updatedCount++

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
              `${logPrefix} ✅ Updated order ${orderData.orderNumber}: ${orderData.currentStatus} → ${mappedStatus}`,
            )
          } else {
            console.log(
              `${logPrefix} ℹ️  Order ${orderData.orderNumber}: Status unchanged (${mappedStatus})`,
            )

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
            `${logPrefix} ❌ Failed to update order ${orderData.orderId}:`,
            error.message,
          )
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

      const duration = Date.now() - startTime
      const summary = {
        totalChecked: trackingData.length,
        updated: updatedCount,
        unchanged: updateResults.filter((r) => r.reason === 'Status unchanged')
          .length,
        errors: updateResults.filter((r) => r.error).length,
        duration,
        results: updateResults,
      }

      console.log(
        `${logPrefix} ✅ Tracking update complete: ${updatedCount}/${trackingData.length} orders updated in ${duration}ms`,
      )
      console.log(`${logPrefix} 📊 Summary:`, {
        totalChecked: summary.totalChecked,
        updated: summary.updated,
        unchanged: summary.unchanged,
        errors: summary.errors,
        duration: summary.duration,
      })

      return summary
    } catch (error) {
      console.error(`${logPrefix} ❌ Tracking status update failed:`, error)
      throw error
    }
  }

  /**
   * Get tracking status for a single order
   * Used by the getSingleOrderTracking controller
   */
  async getSingleOrderTracking(orderId: string) {
    const order = await prisma.orders.findUnique({
      where: { orderId },
      select: {
        orderId: true,
        orderNumber: true,
        status: true,
        clientPhone: true,
        recipientPhone: true,
        trackingNumber: true,
      },
    })

    if (!order) {
      throw new Error('Order not found')
    }

    if (!order.trackingNumber) {
      throw new Error('No tracking number found for this order')
    }

    // Get tracking status from Nova Poshta
    const phoneNumber = order.recipientPhone || order.clientPhone || ''
    const novaPoshtaStatus = await novaPoshtaService.getSingleTrackingStatus(
      order.trackingNumber,
      phoneNumber,
    )

    if (!novaPoshtaStatus) {
      throw new Error('Tracking information not found')
    }

    // Map to our status and create tracking result
    const mappedStatus = mapNovaPoshtaStatusToOrderStatus(
      novaPoshtaStatus.status,
      novaPoshtaStatus.statusCode,
    )

    const trackingResult: OrderTrackingResult = {
      orderId: order.orderId,
      trackingNumber: order.trackingNumber,
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

    return trackingResult
  }
}

// Export singleton instance
export const trackingService = new TrackingService()
export default TrackingService
