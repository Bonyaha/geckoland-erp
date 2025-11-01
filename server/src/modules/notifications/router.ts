// server/src/routes/notificationRoutes.ts
import { Router } from 'express'
import { handleGmailNotification } from './controller'

const router = Router()

// This is the endpoint URL you gave to your Pub/Sub subscription
router.post('/gmail', handleGmailNotification)

export default router
