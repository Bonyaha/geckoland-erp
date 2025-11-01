import { Router } from 'express'
import { getDashboardMetrics } from '../controllers/dashboard/dashboardController'

const router = Router()

router.get('/', getDashboardMetrics)

export default router
