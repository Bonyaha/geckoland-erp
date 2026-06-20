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

// Step 2: Handle Google's browser redirect directly (GET).
// Google sends the user's browser here after they approve access,
// e.g. /api/gmail/callback?code=4/xxxx&scope=...
// This lets the whole flow finish right in the browser tab.
router.get(
  '/callback',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { code, error } = req.query as { code?: string; error?: string }

    if (error) {
      res
        .status(400)
        .send(`<h2>❌ Authorization failed</h2><p>Google returned: ${error}</p>`)
      return
    }

    if (!code) {
      res.status(400).send('<h2>❌ No authorization code received</h2>')
      return
    }

    try {
      await saveToken(code)
      res.send(`
        <h2>✅ Gmail authorization successful</h2>
        <p>Token saved. Now start the Gmail watch:</p>
        <pre>curl -X POST http://localhost:8001/api/gmail/start-watch</pre>
      `)
    } catch (err: any) {
      console.error('❌ Failed to save token from callback:', err)
      res.status(500).send(`<h2>❌ Failed to save token</h2><p>${err.message}</p>`)
    }
  })
)

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
