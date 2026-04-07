import { Request, Response } from 'express'
import prisma from '../../config/database'
import { ErrorFactory } from '../../middleware/errorHandler'
import {
  getAllExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} from '../../services/expenses/expenseService'

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

export const getExpenses = async (
  req: Request,
  res: Response
): Promise<void> => {
  const expenses = await getAllExpenses()
  res.json({ success: true, data: expenses })
}
 
export const createExpenseRecord = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { category, amount, timestamp } = req.body
 
  if (!category || !category.trim()) {
    throw ErrorFactory.badRequest('Назва витрати є обовʼязковою')
  }
  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    throw ErrorFactory.badRequest('Сума є обовʼязковою')
  }
  if (!timestamp) {
    throw ErrorFactory.badRequest('Дата є обовʼязковою')
  }
 
  const expense = await createExpense({
    category: category.trim(),
    amount: Number(amount),
    timestamp: new Date(timestamp),
  })
 
  res.status(201).json({ success: true, data: expense })
} 

export const updateExpenseRecord = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { expenseId } = req.params as { expenseId: string }
  const { category, amount, timestamp } = req.body
 
  if (!expenseId) {
    throw ErrorFactory.badRequest('ID витрати є обовʼязковим')
  }
 
  const expense = await updateExpense(expenseId, {
    ...(category !== undefined && { category: category.trim() }),
    ...(amount !== undefined && { amount: Number(amount) }),
    ...(timestamp !== undefined && { timestamp: new Date(timestamp) }),
  })
 
  res.json({ success: true, data: expense })
} 

export const deleteExpenseRecord = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { expenseId } = req.params as { expenseId: string }
 
  if (!expenseId) {
    throw ErrorFactory.badRequest('ID витрати є обовʼязковим')
  }
 
  await deleteExpense(expenseId)
 
  res.json({ success: true, message: 'Витрату видалено' })
}