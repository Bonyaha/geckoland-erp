// src/routes/authRoutes.ts

import { Router, Request, Response } from 'express'
import {
  getAuthUrl,
  saveToken,
  startGmailWatch,
  stopGmailWatch,
  restartGmailWatch,
} from '../services/gmail/gmailService'
import { asyncHandler } from '../middleware/asyncHandler'

const router = Router()

// Step 1: Get the authorization URL
router.get(
  '/auth',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authUrl = await getAuthUrl()
    res.json({ authUrl })
  })
)

// Step 2: Handle the callback with the authorization code
router.post(
  '/callback',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { code } = req.body
    if (!code) {
      res.status(400).json({ error: 'Authorization code is required' })
      return
    }

    const client = await saveToken(code)
    res.json({
      message: 'Authorization successful',
      clientId: client.credentials.access_token ? 'Set' : 'Not set',
    })
  })
)

// Stop Gmail watch
router.post(
  '/stop-watch',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    await stopGmailWatch()
    res.json({ message: 'Gmail watch stopped successfully' })
  })
)

// Restart Gmail watch
router.post(
  '/restart-watch',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const watchData = await restartGmailWatch()
    res.json({
      message: 'Gmail watch restarted successfully',
      data: watchData,
    })
  })
)
// Step 3: Start Gmail watch (call this after authorization is complete)
router.post(
  '/start-watch',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const watchData = await startGmailWatch()
    res.json({ message: 'Gmail watch started successfully', data: watchData })
  })
)

export default router
