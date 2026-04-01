import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler'
import { validate } from '../middleware/validation'
import { loginSchema, registerSchema } from '../schemas/auth.schema'
import * as authController from '../controllers/auth/authController'

const router = Router()

// POST /api/auth/login
router.post('/login', validate(loginSchema), asyncHandler(authController.login))

// POST /api/auth/register
// (You can remove this later if you want to disable public registration)
router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(authController.register)
)

export default router
