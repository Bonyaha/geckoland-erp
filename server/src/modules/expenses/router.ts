import { Router } from 'express'
import { getExpensesByCategory } from './controller'

const router = Router()

router.get('/', getExpensesByCategory)

export default router
