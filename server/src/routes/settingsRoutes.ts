// server/src/routes/settingsRoutes.ts
import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler'
import {
  setRozetkaStoreStatus,
  getRozetkaStoreStatus,
  setSyncStrategy,
  getSyncStrategy,
} from '../controllers/settings/settingsController'

const router = Router()

router.get('/rozetka-store-status', asyncHandler(getRozetkaStoreStatus))
router.patch('/rozetka-store-status', asyncHandler(setRozetkaStoreStatus))

router.get('/sync-strategy', asyncHandler(getSyncStrategy))
router.patch('/sync-strategy', asyncHandler(setSyncStrategy))

export default router
