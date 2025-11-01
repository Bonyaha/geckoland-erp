import { Router } from 'express'
import { getDashboardMetrics } from './controller'

const router = Router()

router.get('/', getDashboardMetrics)

export default router
