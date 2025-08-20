// This is the webhook that Google Pub/Sub will call.
import { Request, Response } from 'express'
import { google } from 'googleapis'
import { authorize } from '../services/gmailService'

// Store processed history IDs to avoid duplicates
const processedHistoryIds = new Set<string>()
// Store processed message IDs to avoid duplicates
const processedMessageIds = new Set<string>()
// Store the last processed historyId to track progress
let lastProcessedHistoryId: string | null = null

export const handleGmailPush = async (req: Request, res: Response) => {
  // 1. Acknowledge the request immediately to prevent Pub/Sub from retrying
  res.status(204).send()

  try {
    // 2. The actual message is base64 encoded in the body
    const pubSubMessage = req.body.message
    if (!pubSubMessage) {
      console.log('Received non-pub/sub message, ignoring.')
      return
    }

    const data = JSON.parse(
      Buffer.from(pubSubMessage.data, 'base64').toString('utf-8')
    )
    const { emailAddress, historyId } = data

    // Check if we've already processed this historyId
    if (processedHistoryIds.has(historyId)) {
      console.log(
        `⏭️ Skipping duplicate notification for historyId: ${historyId}`
      )
      return
    }

    console.log(
      `🔔 Gmail notification for ${emailAddress} with historyId: ${historyId}`
    )

    // 3. Use the historyId to get only new messages
    const auth = await authorize()
    const gmail = google.gmail({ version: 'v1', auth })

    try {
      let processedMessages = 0
      let foundNewMessages = false

      // Try the history API first, but use a more reliable approach
      if (lastProcessedHistoryId && lastProcessedHistoryId < historyId) {
        console.log(
          `📊 Checking history from ${lastProcessedHistoryId} to ${historyId}`
        )

        try {
          const historyResponse = await gmail.users.history.list({
            userId: 'me',
            startHistoryId: lastProcessedHistoryId,
            historyTypes: ['messageAdded'],
            maxResults: 50,
          })

          console.log(
            `📋 History API response:`,
            JSON.stringify(historyResponse.data, null, 2)
          )

          if (
            historyResponse.data.history &&
            historyResponse.data.history.length > 0
          ) {
            console.log(
              `📬 Found ${historyResponse.data.history.length} history records`
            )

            for (const record of historyResponse.data.history) {
              if (record.messagesAdded && record.messagesAdded.length > 0) {
                console.log(
                  `📥 Found ${record.messagesAdded.length} new messages in this record`
                )
                foundNewMessages = true

                for (const msg of record.messagesAdded) {
                  if (
                    msg.message?.id &&
                    !processedMessageIds.has(msg.message.id)
                  ) {
                    console.log(`📧 Processing message ID: ${msg.message.id}`)
                    await logMessageDetails(gmail, msg.message.id)
                    processedMessages++
                    processedMessageIds.add(msg.message.id)
                  }
                }
              }
            }
          }
        } catch (historyError: any) {
          console.log(`⚠️ History API failed: ${historyError.message}`)
          // Don't throw, fall back to checking recent messages
        }
      }

      // If no messages found via history API or this is the first run, check recent messages
      if (!foundNewMessages) {
        console.log(
          '🔍 No messages found via history API, checking recent messages...'
        )

        const messagesResponse = await gmail.users.messages.list({
          userId: 'me',
          labelIds: ['INBOX'],
          maxResults: 5, // Check last 5 messages
        })

        if (
          messagesResponse.data.messages &&
          messagesResponse.data.messages.length > 0
        ) {
          // Check each recent message to see if it's new
          for (const message of messagesResponse.data.messages) {
            if (message.id && !processedMessageIds.has(message.id)) {
              // Check if this message is actually new (within last 10 minutes)
              const isNew = await isMessageNew(gmail, message.id)
              if (isNew) {
                console.log(`📧 Processing new message: ${message.id}`)
                await logMessageDetails(gmail, message.id)
                processedMessages++
                processedMessageIds.add(message.id)
                foundNewMessages = true
              }
            }
          }
        }
      }

      // Update tracking
      if (foundNewMessages || processedMessages > 0) {
        processedHistoryIds.add(historyId)
        lastProcessedHistoryId = historyId
        console.log(`✅ Processed ${processedMessages} new messages`)
      } else {
        // Still mark as processed to avoid reprocessing, but don't update lastProcessedHistoryId
        processedHistoryIds.add(historyId)
        console.log('📭 No new messages found')
      }

      // Clean up old IDs to prevent memory leak
      cleanupProcessedIds()
    } catch (error) {
      console.error('Error processing Gmail notification:', error)
    }
  } catch (error) {
    console.error('Error parsing Gmail notification:', error)
  }
}

// Helper function to check if a message is new (within last 10 minutes)
async function isMessageNew(gmail: any, messageId: string): Promise<boolean> {
  try {
    const messageDetails = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'metadata',
      metadataHeaders: ['Date'],
    })

    const headers = messageDetails.data.payload?.headers || []
    const dateHeader = headers.find((h: any) => h.name === 'Date')

    if (!dateHeader?.value) {
      console.log(`⚠️ No date header found for message ${messageId}`)
      return false
    }

    const messageDate = new Date(dateHeader.value)
    const now = new Date()
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000)

    const isNew = messageDate > tenMinutesAgo
    console.log(
      `📅 Message ${messageId} date: ${messageDate.toISOString()}, isNew: ${isNew}`
    )

    return isNew
  } catch (error) {
    console.error('Error checking message date:', error)
    return false
  }
}

// Helper function to clean up processed IDs
function cleanupProcessedIds() {
  if (processedHistoryIds.size > 100) {
    const historyEntries = Array.from(processedHistoryIds)
    processedHistoryIds.clear()
    historyEntries.slice(-50).forEach((id) => processedHistoryIds.add(id))
  }

  if (processedMessageIds.size > 200) {
    const messageEntries = Array.from(processedMessageIds)
    processedMessageIds.clear()
    messageEntries.slice(-100).forEach((id) => processedMessageIds.add(id))
  }
}

// Helper function to extract email body text
function extractEmailBody(payload: any): string {
  let body = ''

  // Function to decode base64url
  const decodeBase64Url = (str: string): string => {
    try {
      // Replace URL-safe characters and add padding if needed
      let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
      while (base64.length % 4) {
        base64 += '='
      }
      return Buffer.from(base64, 'base64').toString('utf-8')
    } catch (error) {
      console.error('Error decoding base64:', error)
      return ''
    }
  }

  // Recursive function to extract body from parts
  const extractFromParts = (parts: any[]): string => {
    for (const part of parts) {
      if (part.parts) {
        // If this part has sub-parts, recurse
        const subBody = extractFromParts(part.parts)
        if (subBody) return subBody
      } else if (part.body?.data) {
        // If this part has body data
        if (part.mimeType === 'text/plain') {
          return decodeBase64Url(part.body.data)
        } else if (part.mimeType === 'text/html' && !body) {
          // Use HTML as fallback if no plain text found
          return decodeBase64Url(part.body.data)
        }
      }
    }
    return ''
  }

  // Check if payload has parts (multipart message)
  if (payload.parts) {
    body = extractFromParts(payload.parts)
  } else if (payload.body?.data) {
    // Simple message with direct body
    body = decodeBase64Url(payload.body.data)
  }

  return body || 'No readable body content found'
}

// Helper function to log message details with full body
async function logMessageDetails(gmail: any, messageId: string) {
  try {
    const messageDetails = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full', // Get full message including body
    })

    const headers = messageDetails.data.payload?.headers || []

    const subjectHeader = headers.find((h: any) => h.name === 'Subject')
    const fromHeader = headers.find((h: any) => h.name === 'From')
    const toHeader = headers.find((h: any) => h.name === 'To')
    const dateHeader = headers.find((h: any) => h.name === 'Date')

    const subject = subjectHeader?.value || 'No Subject'
    const from = fromHeader?.value || 'No Sender'
    const to = toHeader?.value || 'No Recipient'
    const date = dateHeader?.value || 'No Date'

    // Extract the email body
    const emailBody = extractEmailBody(messageDetails.data.payload)

    console.log(`\n📧 ===== NEW EMAIL NOTIFICATION =====`)
    console.log(`   From: ${from}`)
    console.log(`   To: ${to}`)
    console.log(`   Subject: ${subject}`)
    console.log(`   Date: ${date}`)
    console.log(`   Message ID: ${messageId}`)
    console.log(
      `   Body Preview: ${emailBody.substring(0, 200)}${
        emailBody.length > 200 ? '...' : ''
      }`
    )
    console.log(`=====================================\n`)

    // TODO: Add your logic here!
    // - Parse the subject/sender to identify Prom/Rozetka orders
    // - Process the full email body
    // - Create an order in your database
    // - You now have access to the full email body in the 'emailBody' variable
  } catch (error) {
    console.error('Error fetching message details:', error)
  }
}
