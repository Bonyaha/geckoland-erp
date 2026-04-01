import { Router } from 'express'
import {
  getExpensesByCategory,
  getExpenses,
  createExpenseRecord,
  updateExpenseRecord,
  deleteExpenseRecord,
} from '../controllers/expenses/expenseController'
import { asyncHandler } from '../middleware/asyncHandler'

const router = Router()

router.get('/by-category', asyncHandler(getExpensesByCategory))

//CRUD endpoints for the Витрати page
router.get('/', asyncHandler(getExpenses))
router.post('/', asyncHandler(createExpenseRecord))
router.patch('/:expenseId', asyncHandler(updateExpenseRecord))
router.delete('/:expenseId', asyncHandler(deleteExpenseRecord))

export default router
