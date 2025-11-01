import { Router } from 'express'
import { getUsers } from './controller'

const router = Router()

router.get('/', getUsers)

export default router
