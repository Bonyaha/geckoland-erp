//Gmail OAuth2 Authentication Helper
/* This module handles the entire authentication flow for accessing the Gmail API from a server-side Node.js app using Google's OAuth2. */
import { promises as fs } from 'fs'
import path from 'path'
import { google } from 'googleapis'
import type { OAuth2Client } from 'googleapis-common'

const CREDENTIALS_PATH = path.join(
  process.cwd(),
  'prisma/google-credentials.json'
)
const TOKEN_PATH = path.join(process.cwd(), 'prisma/gmail-token.json')
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

// Load saved credentials, if they exist
async function loadSavedCredentialsIfExist(): Promise<OAuth2Client | null> {
  try {
    const content = await fs.readFile(TOKEN_PATH)
    const credentials = JSON.parse(content.toString())
    const { client_secret, client_id, redirect_uris } = (
      await getClientSecrets()
    ).web
    const client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    )
    client.setCredentials(credentials)
    return client
  } catch (err) {
    return null
  }
}

// Get client secrets from google-credentials.json
async function getClientSecrets() {
  const content = await fs.readFile(CREDENTIALS_PATH)
  return JSON.parse(content.toString())
}

// Generate an auth URL for the user to visit
export async function getAuthUrl(): Promise<string> {
  const { client_secret, client_id, redirect_uris } = (await getClientSecrets())
    .web
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  )
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // Important to get a refresh token
    scope: SCOPES,
  })
}

// Save the token after user authorization
export async function saveToken(code: string): Promise<OAuth2Client> {
  const { client_secret, client_id, redirect_uris } = (await getClientSecrets())
    .web
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  )
  const { tokens } = await oAuth2Client.getToken(code)
  oAuth2Client.setCredentials(tokens)
  await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens))
  console.log('Token stored to', TOKEN_PATH)
  return oAuth2Client
}

// Main function to get an authorized client
export async function authorize(): Promise<OAuth2Client> {
  let client = await loadSavedCredentialsIfExist()
  if (client) {
    return client
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

export async function restartGmailWatch() {
  console.log('Restarting Gmail watch...')
  try {
    await stopGmailWatch()
    console.log('Waiting 2 seconds before starting watch again...')
    await new Promise((resolve) => setTimeout(resolve, 2000)) // Wait 2 seconds
    const result = await startGmailWatch()
    console.log('Gmail watch restarted successfully')
    return result
  } catch (error) {
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

    if (labelIds.length === 0) {
      console.warn(
        '⚠️ No valid labels found! Watching INBOX instead to avoid missing emails.'
      )
      labelIds.push('INBOX')
    }

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
    console.log(
      'Watch will expire at:',
      new Date(parseInt(res.data.expiration || '0'))
    )
    return res.data
  } catch (error) {
    console.error('Failed to start Gmail watch:', error)
    throw error
  }
}
