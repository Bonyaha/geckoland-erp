// server/src/routes/userRoutes.ts
import { Router } from 'express'
import { getUsers } from '../controllers/users/userController'
import { asyncHandler } from '../middleware/asyncHandler'

const router = Router()

router.get('/', asyncHandler(getUsers))

export default router
