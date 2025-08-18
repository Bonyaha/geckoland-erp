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

export async function startGmailWatch() {
  const auth = await authorize()
  const gmail = google.gmail({ version: 'v1', auth })

  const TOPIC_NAME = 'projects/inventorysync-1/topics/gmail-notifications' // <-- IMPORTANT: Replace with your Project ID

  // You can also filter by labels (e.g., if you have labels for Prom/Rozetka)
  // const LABEL_IDS = ['Label_12345', 'Label_67890'];

  try {
    const res = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: TOPIC_NAME,
        labelIds: ['INBOX'], // Watch the entire inbox
        // labelFilterAction: 'include',
        // labelIds: LABEL_IDS // Or specify labels to watch
      },
    })
    console.log('Gmail watch started successfully:', res.data)
    // The watch is active for 7 days. You'll need to re-run this periodically.
    // The response includes an 'expiration' timestamp.
    return res.data
  } catch (error) {
    console.error('Failed to start Gmail watch:', error)
    throw error
  }
}