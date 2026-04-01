import { Router } from 'express'
import { getDashboardMetrics } from '../controllers/dashboard/dashboardController'
import {asyncHandler} from '../middleware/asyncHandler'

const router = Router()

router.get('/', asyncHandler(getDashboardMetrics))

export default router
