// server/src/routes/settingsRoutes.ts
import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler'
import {
  setRozetkaStoreStatus,
  getRozetkaStoreStatus,
} from '../controllers/settings/settingsController'

const router = Router()

router.get('/rozetka-store-status', asyncHandler(getRozetkaStoreStatus))
router.patch('/rozetka-store-status', asyncHandler(setRozetkaStoreStatus))

export default router
