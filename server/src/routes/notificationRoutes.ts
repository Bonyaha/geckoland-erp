// server/src/routes/notificationRoutes.ts
import { Router } from 'express'
//import { handleGmailNotification } from '../controllers/notificationController'
import { handleTelegramForward } from '../controllers/notificationController'

const router = Router()

// This is the endpoint URL you gave to your Pub/Sub subscription
//router.post('/gmail', handleGmailNotification)
router.post('/telegram', handleTelegramForward)

export default router
