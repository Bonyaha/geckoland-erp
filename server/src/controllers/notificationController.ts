// server/src/controllers/notificationController.ts
// This is the webhook that Google Pub/Sub will call.
import { Request, Response } from 'express'
import { google } from 'googleapis'
import { authorize } from '../services/gmailService'
import type { gmail_v1 } from 'googleapis'
import { promises as fs } from 'fs'
import path from 'path'

// --- NEW: Path to store the last processed history ID ---
const HISTORY_PATH = path.join(process.cwd(), 'prisma/gmail-history.json')

// A cache for label IDs to avoid fetching them on every single notification.
let labelIdMap: Map<string, string> | null = null

/**
 * --- NEW: Load the last known history ID from a file ---
 */
async function loadLastHistoryId(): Promise<string | null> {
  try {
    const content = await fs.readFile(HISTORY_PATH)
    const data = JSON.parse(content.toString())
    return data.historyId
  } catch (error: unknown) {
    // Narrow the unknown to an object that may have a `code` property
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as any).code === 'ENOENT'
    ) {
      return null
    }
    throw error
  }
}

/**
 * --- NEW: Save the latest history ID to a file ---
 */
async function saveLastHistoryId(historyId: string): Promise<void> {
  await fs.writeFile(HISTORY_PATH, JSON.stringify({ historyId }))
}

/**
 * Fetches and caches the mapping of label names to label IDs.
 */
async function initializeLabelCache() {
  if (labelIdMap) return

  console.log('Initializing label cache...')
  const labelNames = ['Prom', 'Rozetka', 'Personal']
  const auth = await authorize()
  const gmail = google.gmail({ version: 'v1', auth })
  const response = await gmail.users.labels.list({ userId: 'me' })
  const labels = response.data.labels || []

  labelIdMap = new Map()
  for (const labelName of labelNames) {
    const foundLabel = labels.find(
      (l) => l.name?.toLowerCase() === labelName.toLowerCase()
    )
    if (foundLabel && foundLabel.id) {
      labelIdMap.set(foundLabel.id, labelName) // Store ID -> Name mapping
    }
  }
  console.log('Label cache initialized:', labelIdMap)
}

/**
 * Decodes the body of a Gmail message part.
 * @param part A Gmail message part.
 * @returns The decoded string content of the part.
 */
function getPartText(part: gmail_v1.Schema$MessagePart): string {
  if (part.body && part.body.data) {
    return Buffer.from(part.body.data, 'base64').toString('utf-8')
  }

  if (part.parts) {
    for (const subPart of part.parts) {
      if (subPart.mimeType === 'text/plain') {
        return getPartText(subPart)
      }
    }
    return getPartText(part.parts[0])
  }
  return ''
}

/**
 * Main controller to handle incoming Pub/Sub notifications from Gmail.
 */
export const handleGmailNotification = async (req: Request, res: Response) => {
  res.status(204).send() // Acknowledge immediately

  try {
    await initializeLabelCache()
    if (!labelIdMap) throw new Error('Label cache is not initialized.')

    const pubSubMessage = req.body.message
    if (!pubSubMessage || !pubSubMessage.data) {
      console.log('Received an invalid Pub/Sub message.')
      return
    }

    const decodedData = JSON.parse(
      Buffer.from(pubSubMessage.data, 'base64').toString('utf-8')
    )
    const newHistoryId = decodedData.historyId

    // --- MODIFIED LOGIC ---
    const lastHistoryId = await loadLastHistoryId()

    // If this is the first ever notification, we don't have a previous history ID to compare against.
    // So, we save the current ID and wait for the *next* notification.
    if (!lastHistoryId) {
      await saveLastHistoryId(newHistoryId)
      console.log(
        'First run: Stored initial history ID. Will process new messages on the next notification.'
      )
      return
    }

    const auth = await authorize()
    const gmail = google.gmail({ version: 'v1', auth })

    // Fetch the history of changes since the LAST notification.
    const historyResponse = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: lastHistoryId, // <-- Use the last known ID
      historyTypes: ['messageAdded'],
    })

    const historyRecords = historyResponse.data.history
    if (!historyRecords || historyRecords.length === 0) {
      console.log('No new messages found in history since last check.')
      // IMPORTANT: Still save the new history ID to keep our state up-to-date
      await saveLastHistoryId(newHistoryId)
      return
    }

    for (const record of historyRecords) {
      if (!record.messagesAdded) continue

      for (const messageAdded of record.messagesAdded) {
        if (!messageAdded.message || !messageAdded.message.id) continue

        const messageId = messageAdded.message.id

        const messageDetails = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full',
        })

        const { payload, labelIds } = messageDetails.data
        if (!payload || !labelIds) continue

        // Check if the message has one of our target labels.
        const relevantLabelId = labelIds.find((id) => labelIdMap!.has(id))
        if (!relevantLabelId) {
          console.log(
            `Message ${messageId} does not have a relevant label. Skipping.`
          )
          continue
        }

        const labelName = labelIdMap.get(relevantLabelId)
        console.log(`Processing new email with label: "${labelName}"`)

        const headers = payload.headers || []
        const subject =
          headers.find((h) => h.name === 'Subject')?.value || 'No Subject'
        const body = getPartText(payload)

        console.log('--- New Email Received ---')
        console.log('Subject:', subject)
        console.log('Body Snippet:', body.substring(0, 200) + '...')
        console.log('--------------------------')

        if (labelName === 'Prom') {
          if (
            subject.includes('У вас нове замовлення...') &&
            body.includes('У вас нове замовлення...')
          ) {
            console.log(
              'New order on Prom has arrived, I am calling createOrder route...'
            )
          }
        } else if (labelName === 'Rozetka') {
          if (
            subject.includes('Надійшло замовлення №...') &&
            body.includes('Вам надійшло нове замовлення!')
          ) {
            console.log(
              'New order on Rozetka has arrived, I am calling createOrder route...'
            )
          }
        }

        await gmail.users.messages.modify({
          userId: 'me',
          id: messageId,
          requestBody: { removeLabelIds: ['UNREAD'] },
        })
        console.log(`Message ${messageId} marked as read.`)
      }
    }

    // --- IMPORTANT: Save the new history ID after processing ---
    await saveLastHistoryId(newHistoryId)
    console.log(`Successfully processed history up to ID: ${newHistoryId}`)
  } catch (error) {
    console.error('Error handling Gmail notification:', error)
  }
}
