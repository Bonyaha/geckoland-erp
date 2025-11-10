import { Request, Response } from 'express'
import prisma from '../../config/database'
import { ErrorFactory } from '../../middleware/errorHandler'

export const getExpensesByCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  // 1️⃣ Fetch all expenses by category
  const expenseByCategorySummaryRaw = await prisma.expenseByCategory.findMany({
    orderBy: {
      date: 'desc',
    },
  })

  // 2️⃣ Handle case where query returns nothing
  if (
    !expenseByCategorySummaryRaw ||
    expenseByCategorySummaryRaw.length === 0
  ) {
    throw ErrorFactory.notFound('No expenses by category found')
  }

  // 3️⃣ Convert Decimal → string for JSON safety
  const expenseByCategorySummary = expenseByCategorySummaryRaw.map((item) => ({
    ...item,
    amount: item.amount.toString(),
  }))

  res.json(expenseByCategorySummary)
}
