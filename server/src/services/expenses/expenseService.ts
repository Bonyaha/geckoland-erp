// server/src/services/expenses/expenseService.ts

import prisma from '../../config/database'

export interface ExpenseRecord {
  expenseId: string
  category: string
  amount: number
  timestamp: Date
}

export interface CreateExpenseInput {
  category: string
  amount: number
  timestamp: Date
}

export interface UpdateExpenseInput {
  category?: string
  amount?: number
  timestamp?: Date
}

/**
 * Get all expenses ordered by date descending
 */
export async function getAllExpenses(): Promise<ExpenseRecord[]> {
  const expenses = await prisma.expenses.findMany({
    orderBy: { timestamp: 'desc' },
  })

  return expenses.map((e) => ({
    expenseId: e.expenseId,
    category: e.category,
    amount: Number(e.amount),
    timestamp: e.timestamp,
  }))
}

/**
 * Create a new expense record
 */
export async function createExpense(
  input: CreateExpenseInput,
): Promise<ExpenseRecord> {
  // Generate a cuid-like ID using crypto
  const { randomUUID } = await import('crypto')
  const expenseId = randomUUID()

  const expense = await prisma.expenses.create({
    data: {
      expenseId,
      category: input.category,
      amount: input.amount,
      timestamp: input.timestamp,
    },
  })

  return {
    expenseId: expense.expenseId,
    category: expense.category,
    amount: Number(expense.amount),
    timestamp: expense.timestamp,
  }
}

/**
 * Update an existing expense record
 */
export async function updateExpense(
  expenseId: string,
  input: UpdateExpenseInput,
): Promise<ExpenseRecord> {
  const expense = await prisma.expenses.update({
    where: { expenseId },
    data: {
      ...(input.category !== undefined && { category: input.category }),
      ...(input.amount !== undefined && { amount: input.amount }),
      ...(input.timestamp !== undefined && { timestamp: input.timestamp }),
    },
  })

  return {
    expenseId: expense.expenseId,
    category: expense.category,
    amount: Number(expense.amount),
    timestamp: expense.timestamp,
  }
}

/**
 * Delete an expense record
 */
export async function deleteExpense(expenseId: string): Promise<void> {
  await prisma.expenses.delete({ where: { expenseId } })
}
