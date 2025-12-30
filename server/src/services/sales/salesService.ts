// server/src/services/sales/salesService.ts
import prisma from '../../config/database'
import { Decimal } from '@prisma/client/runtime/library'
import { nanoid } from 'nanoid'
import { ErrorFactory } from '../../middleware/errorHandler'
import { OrderStatus } from '@prisma/client'
import {
  SalesCreationResult,
  SalesBackfillResult,
  SalesStatistics,
} from '../../types/sales'


/**
 * Service to handle Sales table operations
 * Automatically creates Sales records when orders are marked as DELIVERED
 */
class SalesService {
  /**
   * Create sales records for a delivered order
   * This is called automatically when an order status changes to DELIVERED
   *
   * @param orderId - The ID of the order that was delivered
   * @returns Result with created sales IDs or error
   */
  async createSalesFromOrder(orderId: string): Promise<SalesCreationResult> {
    try {
      // Fetch the order with all items
      const order = await prisma.orders.findUnique({
        where: { orderId },
        include: {
          orderItems: true,
        },
      })

      if (!order) {
        throw ErrorFactory.notFound(`Order ${orderId} not found`)
      }

      // Verify order is actually delivered
      if (order.status !== OrderStatus.DELIVERED) {
        console.log(
          `⚠️ Order ${orderId} is not DELIVERED (status: ${order.status}), skipping sales creation`
        )
        return {
          success: false,
          salesIds: [],
          orderNumber: order.orderNumber || undefined,
          error: `Order status is ${order.status}, not DELIVERED`,
        }
      }

      // Check if sales records already exist for this order
      const existingSales = await prisma.sales.findMany({
        where: {
          saleId: {
            startsWith: `sale_${orderId}`,
          },
        },
      })

      if (existingSales.length > 0) {
        console.log(
          `ℹ️ Sales records already exist for order ${orderId}, skipping creation`
        )
        return {
          success: true,
          salesIds: existingSales.map((s) => s.saleId),
          orderNumber: order.orderNumber || undefined,
          error: 'Sales records already exist',
        }
      }

      // Create sales records for each order item
      const salesIds: string[] = []
      const timestamp = order.lastModified || order.createdAt

      for (const item of order.orderItems) {
        // Skip items without productId (cannot track sales without product reference)
        if (!item.productId) {
          console.warn(
            `⚠️ OrderItem ${item.orderItemId} has no productId, skipping sales record creation`
          )
          continue
        }

        const saleId = `sale_${orderId}_${item.productId}_${nanoid(6)}`

        await prisma.sales.create({
          data: {
            saleId,
            productId: item.productId,
            timestamp,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalAmount: item.totalPrice,
          },
        })

        salesIds.push(saleId)
      }

      console.log(
        `✅ Created ${salesIds.length} sales records for order ${
          order.orderNumber || orderId
        }`
      )

      return {
        success: true,
        salesIds,
        orderNumber: order.orderNumber || undefined,
      }
    } catch (error: any) {
      console.error(
        `❌ Error creating sales records for order ${orderId}:`,
        error
      )
      return {
        success: false,
        salesIds: [],
        error: error.message || 'Unknown error',
      }
    }
  }

  /**
   * Backfill sales records for all existing delivered orders
   * This is a one-time migration function to populate the Sales table
   *
   * @returns Summary of backfill operation
   */
  async backfillSalesFromDeliveredOrders(): Promise<SalesBackfillResult> {
    console.log('🔄 Starting sales backfill process...')

    const result: SalesBackfillResult = {
      totalProcessed: 0,
      successfulOrders: 0,
      failedOrders: 0,
      totalSalesCreated: 0,
      errors: [],
    }

    try {
      // Find all delivered orders
      const deliveredOrders = await prisma.orders.findMany({
        where: {
          status: OrderStatus.DELIVERED,
        },
        include: {
          orderItems: true,
        },
        orderBy: {
          createdAt: 'asc', // Process oldest first
        },
      })

      console.log(
        `📦 Found ${deliveredOrders.length} delivered orders to process`
      )

      // Process each order
      for (const order of deliveredOrders) {
        result.totalProcessed++

        try {
          // Check if sales records already exist for this order
          const existingSales = await prisma.sales.findMany({
            where: {
              saleId: {
                startsWith: `sale_${order.orderId}`,
              },
            },
          })

          if (existingSales.length > 0) {
            console.log(
              `ℹ️ Order ${
                order.orderNumber || order.orderId
              } already has sales records, skipping`
            )
            result.successfulOrders++
            result.totalSalesCreated += existingSales.length
            continue
          }

          // Create sales records for each item
          const timestamp = order.lastModified || order.createdAt
          let createdCount = 0

          for (const item of order.orderItems) {
            // Skip items without productId
            if (!item.productId) {
              console.warn(
                `⚠️ OrderItem ${item.orderItemId} in order ${
                  order.orderNumber || order.orderId
                } has no productId, skipping`
              )
              continue
            }

            const saleId = `sale_${order.orderId}_${item.productId}_${nanoid(
              6
            )}`

            await prisma.sales.create({
              data: {
                saleId,
                productId: item.productId,
                timestamp,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalAmount: item.totalPrice,
              },
            })

            createdCount++
          }

          if (createdCount > 0) {
            result.successfulOrders++
            result.totalSalesCreated += createdCount
            console.log(
              `✅ Created ${createdCount} sales records for order ${
                order.orderNumber || order.orderId
              }`
            )
          } else {
            console.warn(
              `⚠️ No sales records created for order ${
                order.orderNumber || order.orderId
              } (no valid items)`
            )
          }
        } catch (error: any) {
          result.failedOrders++
          const errorMsg = error.message || 'Unknown error'
          result.errors.push({
            orderId: order.orderId,
            orderNumber: order.orderNumber || undefined,
            error: errorMsg,
          })
          console.error(
            `❌ Failed to create sales for order ${
              order.orderNumber || order.orderId
            }:`,
            errorMsg
          )
        }
      }

      console.log('✅ Sales backfill complete!')
      console.log(`📊 Summary:`)
      console.log(`   Total orders processed: ${result.totalProcessed}`)
      console.log(`   Successful orders: ${result.successfulOrders}`)
      console.log(`   Failed orders: ${result.failedOrders}`)
      console.log(`   Total sales created: ${result.totalSalesCreated}`)

      return result
    } catch (error: any) {
      console.error('❌ Fatal error during sales backfill:', error)
      throw ErrorFactory.internal(
        `Sales backfill failed: ${error.message || 'Unknown error'}`
      )
    }
  }

  /**
   * Get sales statistics for a specific time period
   * Useful for generating reports
   */
  async getSalesStats(
    startDate: Date,
    endDate: Date
  ): Promise<SalesStatistics> {
    const sales = await prisma.sales.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        product: true,
      },
    })

    const totalRevenue = sales.reduce(
      (sum, sale) => sum.add(sale.totalAmount),
      new Decimal(0)
    )

    const totalQuantity = sales.reduce((sum, sale) => sum + sale.quantity, 0)

    return {
      totalSales: sales.length,
      totalRevenue: totalRevenue.toNumber(),
      totalQuantity,
      averageOrderValue:
        sales.length > 0 ? totalRevenue.div(sales.length).toNumber() : 0,
    }
  }
}

export default SalesService
