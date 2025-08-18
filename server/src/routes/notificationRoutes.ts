import { Router } from 'express'
import { handleGmailPush } from '../controllers/notificationController'

const router = Router()

// This is the endpoint URL you gave to your Pub/Sub subscription
router.post('/gmail', handleGmailPush)

export default router
