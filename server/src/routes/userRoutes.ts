import { Router } from 'express'
import { getUsers } from '../controllers/users/userController'

const router = Router()

router.get('/', getUsers)

export default router
