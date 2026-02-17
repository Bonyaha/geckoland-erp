//server/src/services/gmail/gmailService.ts
//Gmail OAuth2 Authentication Helper
/* This module handles the entire authentication flow for accessing the Gmail API from a server-side Node.js app using Google's OAuth2. */
//Authorization was at 22.09
import { promises as fs } from 'fs'
import path from 'path'
import { google } from 'googleapis'
import type { OAuth2Client } from 'googleapis-common'
import { config } from '../../config/environment'

const TOKEN_PATH = path.join(process.cwd(), 'src/config/credentials/gmail-token.json')
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
]

// Load saved credentials, if they exist
async function loadSavedCredentialsIfExist(): Promise<OAuth2Client | null> {
  try {
    const content = await fs.readFile(TOKEN_PATH)
    const credentials = JSON.parse(content.toString())
    
    const client = new google.auth.OAuth2(
      config.gmail.clientId,
      config.gmail.clientSecret,
      config.gmail.redirectUri,
    )
    client.setCredentials(credentials)

    // Set up automatic token refresh and save
    client.on('tokens', async (tokens) => {
      console.log('🔄 Refreshing Gmail tokens...')
      if (tokens.refresh_token) {
        // Only update refresh_token if we got a new one
        credentials.refresh_token = tokens.refresh_token
      }
      if (tokens.access_token) {
        credentials.access_token = tokens.access_token
      }
      if (tokens.expiry_date) {
        credentials.expiry_date = tokens.expiry_date
      }

      try {
        await fs.writeFile(TOKEN_PATH, JSON.stringify(credentials))
        console.log('✅ Gmail tokens refreshed and saved')
      } catch (error) {
        console.error('❌ Failed to save refreshed tokens:', error)
      }
    })

    return client
  } catch (err) {
    return null
  }
}

// Test if the token is still valid or can be refreshed
async function isTokenValid(client: OAuth2Client): Promise<boolean> {
  const gmail = google.gmail({ version: 'v1', auth: client })
  try {
    await gmail.users.getProfile({ userId: 'me' })
    return true
  } catch (error: any) {
    // Check if it's an auth error
    if (
      error.response?.status === 401 ||
      error.message?.includes('invalid_grant') ||
      error.message?.includes('invalid_token')
    ) {
      console.log('🔄 Access token expired, attempting to refresh...')

      try {
        // Try to refresh the token
        const { credentials } = await client.refreshAccessToken()
        client.setCredentials(credentials)

        // Test again after refresh
        await gmail.users.getProfile({ userId: 'me' })
        console.log('✅ Token refreshed successfully')
        return true
      } catch (refreshError: any) {
        console.log('❌ Token refresh failed:', refreshError.message)
        return false
      }
    }

    // Other errors might be network issues
    console.warn(
      '⚠️ Network or other error (assuming token is valid):',
      error.message
    )
    return true
  }
}

// Generate an auth URL for the user to visit
export async function getAuthUrl(): Promise<string> { 
  const oAuth2Client = new google.auth.OAuth2(
    config.gmail.clientId,
    config.gmail.clientSecret,
    config.gmail.redirectUri,
  )
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline', // This ensures we get a refresh token
    prompt: 'consent', // Forces consent screen to ensure refresh token
    scope: SCOPES,
  })
}

// Save the token after user authorization
export async function saveToken(code: string): Promise<OAuth2Client> {  
  const oAuth2Client = new google.auth.OAuth2(
    config.gmail.clientId,
    config.gmail.clientSecret,
    config.gmail.redirectUri,
  )
  const { tokens } = await oAuth2Client.getToken(code)
  oAuth2Client.setCredentials(tokens)
  // Ensure we save all token data
  const tokenData = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    scope: tokens.scope,
    token_type: tokens.token_type,
    expiry_date: tokens.expiry_date,
  }

  await fs.writeFile(TOKEN_PATH, JSON.stringify(tokenData))
  console.log('✅ Token stored to', TOKEN_PATH)

  return oAuth2Client
}

// Clear invalid token
async function clearInvalidToken(): Promise<void> {
  try {
    await fs.unlink(TOKEN_PATH)
    console.log('Invalid token file deleted')
  } catch (error) {
    // File might not exist, which is fine
  }
}

// Check if token exists
export async function hasValidToken(): Promise<boolean> {
  const client = await loadSavedCredentialsIfExist()
  if (!client) return false
  return await isTokenValid(client)
}

// Main function to get an authorized client
export async function authorize(): Promise<OAuth2Client> {
  let client = await loadSavedCredentialsIfExist()
  if (client) {
    // Test if the token is still valid
    const isValid = await isTokenValid(client)
    if (isValid) {
      return client
    } else {
      // Token is invalid, clear it
      await clearInvalidToken()
    }
  }
  // If no token, you need to run the auth flow.
  // For a server app, you'd typically do this once via a dedicated route.
  throw new Error('No token found. Please authorize first.')
}

// Helper function to get label IDs by name
export async function getLabelIds(labelNames: string[]): Promise<string[]> {
  const auth = await authorize()
  const gmail = google.gmail({ version: 'v1', auth })

  try {
    const response = await gmail.users.labels.list({ userId: 'me' }) // this call is fetching all Gmail labels (like "Inbox", "Sent", "Draft", custom labels, etc.) for the authenticated user's account.
    const labels = response.data.labels || []

    const labelIds: string[] = []
    for (const labelName of labelNames) {
      const label = labels.find(
        (l) => l.name?.toLowerCase() === labelName.toLowerCase()
      )
      if (label && label.id) {
        labelIds.push(label.id)
        console.log(`Found label "${labelName}" with ID: ${label.id}`)
      } else {
        console.warn(`Label "${labelName}" not found`)
      }
    }

    return labelIds
  } catch (error) {
    console.error('Error fetching labels:', error)
    return []
  }
}

export async function stopGmailWatch() {
  const auth = await authorize()
  const gmail = google.gmail({ version: 'v1', auth })

  try {
    await gmail.users.stop({ userId: 'me' })
    console.log('Gmail watch stopped successfully')
  } catch (error) {
    console.error('Failed to stop Gmail watch:', error)
    throw error
  }
}

// Safe restart function that checks for token first
export async function restartGmailWatch() {
  console.log('Restarting Gmail watch...')

  // Check if we have a valid token first
  const hasToken = await hasValidToken()
  if (!hasToken) {
    console.log('❌ No valid Gmail token found. Skipping Gmail watch restart.')
    console.log(
      '🔗 To enable Gmail notifications, please authorize by visiting: GET /auth/gmail/auth'
    )
    return null
  }

  try {
    // Try to stop existing watch (ignore errors if no watch exists)
    try {
      await stopGmailWatch()
      console.log('Waiting 2 seconds before starting watch again...')
      await new Promise((resolve) => setTimeout(resolve, 2000))
    } catch (stopError) {
      console.log(
        'Could not stop existing watch (this is OK if none was running)'
      )
    }

    const result = await startGmailWatch()
    console.log('✅ Gmail watch restarted successfully')
    return result
  } catch (error: any) {
    if (
      error.message?.includes('No valid token found') ||
      error.message?.includes('No token found')
    ) {
      console.error(
        '❌ Gmail watch could not be started: Token expired or invalid'
      )
      console.log('🔗 Please re-authorize by calling GET /auth/gmail/auth')
      throw new Error('Gmail authorization required. Please re-authorize.')
    }
    console.error('Failed to restart Gmail watch:', error)
    throw error
  }
}

export async function startGmailWatch() {
  const auth = await authorize()
  const gmail = google.gmail({ version: 'v1', auth })

  const TOPIC_NAME = 'projects/inventorysync-1/topics/gmail-notifications' // <-- IMPORTANT: This must be your Project ID

  try {
    // Get label IDs for Prom and Rozetka
    // Replace these with your actual label names
    const labelNames = ['Prom', 'Rozetka', 'Personal']
    const labelIds = await getLabelIds(labelNames)

    // Watch specific labels only
    const watchLabels = [...labelIds]

    console.log('Watching labels:', watchLabels)

    const res = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: TOPIC_NAME,
        labelIds: watchLabels,
        labelFilterBehavior: 'INCLUDE', // Only watch emails with these labels
        // Note: Gmail watch will still trigger for all events (messageAdded, labelsAdded, labelsRemoved, etc.)
        // but we filter for messageAdded in the notification controller
      },
    })
    console.log('Gmail watch started successfully:', res.data)
    // The watch is active for 7 days. You'll need to re-run this periodically.
    // The response includes an 'expiration' timestamp.
    const expirationDate = new Date(parseInt(res.data.expiration || '0'))
    console.log('⏰ Watch expires:', expirationDate.toLocaleString())

    return res.data
  } catch (error: any) {
    console.error('❌ Failed to start Gmail watch:', error)

    // Transform to business error if needed
    if (error.code === 401) {
      throw new Error('Gmail authorization expired. Please re-authenticate.')
    }
    throw error
  }
}
