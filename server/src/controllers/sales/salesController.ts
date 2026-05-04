// server/src/controllers/sales/salesController.ts
import { Request, Response } from 'express'
import SalesService from '../../services/sales/salesService'
import { ErrorFactory } from '../../middleware/errorHandler'
import prisma, { OrderStatus } from '../../config/database'
import { SalesHealthCheck, SalesHealthOrderDetail } from '../../types/sales'

const salesService = new SalesService()

/**
 * Backfill sales records for all existing delivered orders
 * This is a one-time migration endpoint
 * @route POST /api/sales/backfill
 */
export const backfillSales = async (
  req: Request,
  res: Response,
): Promise<void> => {
  console.log('🔄 Received request to backfill sales records')

  try {
    const result = await salesService.backfillSalesFromDeliveredOrders()

    // Determine appropriate status code based on results
    const hasErrors = result.failedOrders > 0
    const statusCode = hasErrors ? 207 : 200 // 207 Multi-Status if some failed

    res.status(statusCode).json({
      success: true,
      message: hasErrors
        ? `Sales backfill completed with ${result.failedOrders} errors`
        : 'Sales backfill completed successfully',
      data: {
        summary: {
          totalProcessed: result.totalProcessed,
          successfulOrders: result.successfulOrders,
          failedOrders: result.failedOrders,
          totalSalesCreated: result.totalSalesCreated,
        },
        errors: result.errors,
      },
    })
  } catch (error: any) {
    console.error('❌ Error during sales backfill:', error)
    throw ErrorFactory.internal(
      `Sales backfill failed: ${error.message || 'Unknown error'}`,
    )
  }
}

/**
 * Manually create sales records for a specific order
 * Useful if automatic creation failed
 * @route POST /api/sales/create/:orderId
 */
export const createSalesForOrder = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { orderId } = req.params as { orderId: string }

  if (!orderId) {
    throw ErrorFactory.badRequest('Order ID is required')
  }

  console.log(`📈 Creating sales records for order ${orderId}`)

  const result = await salesService.createSalesFromOrder(orderId)

  if (!result.success) {
    throw ErrorFactory.badRequest(
      result.error || 'Failed to create sales records',
    )
  }

  res.status(201).json({
    success: true,
    message: `Created ${result.salesIds.length} sales records for order ${
      result.orderNumber || orderId
    }`,
    data: {
      orderNumber: result.orderNumber,
      salesIds: result.salesIds,
    },
  })
}

/**
 * Get sales statistics for a date range
 * @route GET /api/sales/stats
 * @query startDate - ISO date string
 * @query endDate - ISO date string
 */
export const getSalesStats = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { startDate, endDate } = req.query

  if (!startDate || !endDate) {
    throw ErrorFactory.badRequest('startDate and endDate are required')
  }

  const start = new Date(startDate as string)
  const end = new Date(endDate as string)

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw ErrorFactory.badRequest('Invalid date format')
  }

  if (start > end) {
    throw ErrorFactory.badRequest('startDate must be before endDate')
  }

  const stats = await salesService.getSalesStats(start, end)

  res.status(200).json({
    success: true,
    data: {
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      stats,
    },
  })
}

/**
 * Health check endpoint to verify sales are being created
 * Checks recent delivered orders and their sales records
 * @route GET /api/sales/health
 */
export const checkSalesHealth = async (
  req: Request,
  res: Response,
): Promise<void> => {
  // Get recent delivered orders (last 7 days)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const recentDeliveredOrders = await prisma.orders.findMany({
    where: {
      status: OrderStatus.DELIVERED,
      lastModified: {
        gte: sevenDaysAgo,
      },
    },
    select: {
      orderId: true,
      orderNumber: true,
      lastModified: true,
    },
    take: 10,
  })

  // Check which orders have sales records
  const healthChecks: SalesHealthOrderDetail[] = await Promise.all(
    recentDeliveredOrders.map(async (order) => {
      const salesCount = await prisma.sales.count({
        where: {
          saleId: {
            startsWith: `sale_${order.orderId}`,
          },
        },
      })

      return {
        orderId: order.orderId,
        orderNumber: order.orderNumber || undefined,
        deliveredAt: order.lastModified || undefined,
        hasSalesRecords: salesCount > 0,
        salesCount,
      }
    }),
  )

  const ordersWithSales = healthChecks.filter((c) => c.hasSalesRecords).length
  const ordersWithoutSales = healthChecks.filter(
    (c) => !c.hasSalesRecords,
  ).length

  const healthResponse: SalesHealthCheck = {
    summary: {
      totalChecked: healthChecks.length,
      ordersWithSales,
      ordersWithoutSales,
      healthPercentage:
        healthChecks.length > 0
          ? ((ordersWithSales / healthChecks.length) * 100).toFixed(2)
          : '100.00',
    },
    recentOrders: healthChecks,
  }

  res.status(200).json({
    success: true,
    message: 'Sales health check completed',
    data: healthResponse,
  })
}

/**
 * Get sales data for multiple products
 * Returns aggregated sales information per product
 * @route POST /api/sales/products
 * @body productIds - Array of product IDs to get sales data for
 * @body startDate - Optional ISO date string to filter sales from this date onwards
 */
export const getProductsSalesData = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { productIds, startDate } = req.body

  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    throw ErrorFactory.badRequest('productIds array is required')
  }

  console.log(
    `📊 Fetching sales data for ${productIds.length} products${startDate ? ` from ${startDate}` : ''}`,
  )

  // Build the where clause for sales filtering
  const where: any = {
    productId: {
      in: productIds,
    },
  }

  if (startDate) {
    const filterDate = new Date(startDate)
    if (!isNaN(filterDate.getTime())) {
      where.createdAt = {
        gte: filterDate,
      }
    }
  }

  const grouped = await prisma.sales.groupBy({
    by: ['productId'],
    where,
    _sum: {
      quantity: true,
      totalAmount: true,
    },
    _count: {
      saleId: true,
    },
  })

  // For lastSaleDate we still need one extra query per product, but only
  // fetching a single row each time (composite index makes this fast).
  const lastSaleDates = await prisma.sales.findMany({
    where,
    select: { productId: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    distinct: ['productId'],
  })

  const lastSaleDateMap = new Map(
    lastSaleDates.map((s) => [s.productId, s.createdAt.toISOString()]),
  )

  //initialize result map with zeros for every requested productId
  // so products with no sales still appear in the response
  const salesDataMap: Record<
    string,
    {
      productId: string
      totalQuantitySold: number
      totalRevenue: number
      salesCount: number
      lastSaleDate: string | null
    }
  > = {}

  for (const productId of productIds) {
    salesDataMap[productId] = {
      productId,
      totalQuantitySold: 0,
      totalRevenue: 0,
      salesCount: 0,
      lastSaleDate: null,
    }
  }

  for (const row of grouped) {
    salesDataMap[row.productId] = {
      productId: row.productId,
      totalQuantitySold: row._sum.quantity ?? 0,
      totalRevenue: parseFloat((row._sum.totalAmount ?? 0).toString()),
      salesCount: row._count.saleId,
      lastSaleDate: lastSaleDateMap.get(row.productId) ?? null,
    }
  }

  res.status(200).json(salesDataMap)
}
