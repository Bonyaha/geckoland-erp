import { Request, Response } from 'express'
import prisma from '../../config/database'
import { ErrorFactory } from '../../middleware/errorHandler'

export const getDashboardMetrics = async (
  req: Request,
  res: Response
): Promise<void> => {
  // 1️⃣ Fetch all dashboard data
  const [
    popularProducts,
    salesSummary,
    purchaseSummary,
    expenseSummary,
    expenseByCategorySummaryRaw,
  ] = await Promise.all([
    prisma.products.findMany({
      take: 15,
      orderBy: { stockQuantity: 'desc' },
    }),
    prisma.salesSummary.findMany({
      take: 5,
      orderBy: { date: 'desc' },
    }),
    prisma.purchaseSummary.findMany({
      take: 5,
      orderBy: { date: 'desc' },
    }),
    prisma.expenseSummary.findMany({
      take: 5,
      orderBy: { date: 'desc' },
    }),
    prisma.expenseByCategory.findMany({
      take: 5,
      orderBy: { date: 'desc' },
    }),
  ])

  // 2️⃣ Optional: Handle edge cases gracefully
  if (!popularProducts || !salesSummary || !purchaseSummary) {
    throw ErrorFactory.internal('Error retrieving dashboard metrics')
  }

  // 3️⃣ Convert decimals to strings for JSON safety
  const expenseByCategorySummary = expenseByCategorySummaryRaw.map((item) => ({
    ...item,
    amount: item.amount.toString(),
  }))

  // 4️⃣ Send successful response
  res.json({
    popularProducts,
    salesSummary,
    purchaseSummary,
    expenseSummary,
    expenseByCategorySummary,
  })
}
