import { Router } from 'express'
import { getExpensesByCategory } from '../controllers/expenses/expenseController'
import { asyncHandler } from '../middleware/asyncHandler'

const router = Router()

router.get('/', asyncHandler(getExpensesByCategory))

export default router
