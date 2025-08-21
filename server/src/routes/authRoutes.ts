// src/routes/authRoutes.ts

import { Router, Request, Response } from 'express'
import {
  getAuthUrl,
  saveToken,
  startGmailWatch,
  stopGmailWatch,
  restartGmailWatch,
} from '../services/gmailService'

const router = Router()

// Step 1: Get the authorization URL
router.get(
  '/gmail/auth',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const authUrl = await getAuthUrl()
      res.json({ authUrl })
    } catch (error) {
      console.error('Error getting auth URL:', error)
      res.status(500).json({ error: 'Failed to get authorization URL' })
    }
  }
)

// Step 2: Handle the callback with the authorization code
router.post(
  '/gmail/callback',
  async (req: Request, res: Response): Promise<void> => {
    try {
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
    } catch (error) {
      console.error('Error saving token:', error)
      res.status(500).json({ error: 'Failed to save authorization token' })
    }
  }
)

// Stop Gmail watch
router.post(
  '/gmail/stop-watch',
  async (req: Request, res: Response): Promise<void> => {
    try {
      await stopGmailWatch()
      res.json({ message: 'Gmail watch stopped successfully' })
    } catch (error) {
      console.error('Error stopping Gmail watch:', error)
      res.status(500).json({ error: 'Failed to stop Gmail watch' })
    }
  }
)

// Restart Gmail watch
router.post(
  '/gmail/restart-watch',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const watchData = await restartGmailWatch()
      res.json({
        message: 'Gmail watch restarted successfully',
        data: watchData,
      })
    } catch (error) {
      console.error('Error restarting Gmail watch:', error)
      res.status(500).json({ error: 'Failed to restart Gmail watch' })
    }
  }
)
// Step 3: Start Gmail watch (call this after authorization is complete)
router.post(
  '/gmail/start-watch',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const watchData = await startGmailWatch()
      res.json({ message: 'Gmail watch started successfully', data: watchData })
    } catch (error) {
      console.error('Error starting Gmail watch:', error)
      res.status(500).json({ error: 'Failed to start Gmail watch' })
    }
  }
)

export default router
