// This is the webhook that Google Pub/Sub will call.
import { Request, Response } from 'express'
import { google } from 'googleapis'
import { authorize } from '../services/gmailService'

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

    console.log(
      `🔔 New notification for ${emailAddress} with historyId: ${historyId}`
    )

    // 3. Use the historyId to get the latest message
    const auth = await authorize()
    const gmail = google.gmail({ version: 'v1', auth })

    // First, try to get messages from history
    const historyResponse = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: historyId,
      historyTypes: ['messageAdded'],
    })

    let foundMessages = false

    if (historyResponse.data.history) {
      // 4. Fetch the newest message details from history
      for (const record of historyResponse.data.history) {
        if (record.messagesAdded) {
          for (const msg of record.messagesAdded) {
            if (msg.message?.id) {
              foundMessages = true
              await logMessageDetails(gmail, msg.message.id)
            }
          }
        }
      }
    }

    // If no messages found in history, try to get the latest messages directly
    if (!foundMessages) {
      console.log(
        'No new messages found in history, checking latest messages...'
      )

      const messagesResponse = await gmail.users.messages.list({
        userId: 'me',
        q: 'in:inbox',
        maxResults: 5, // Check the last 5 messages
      })

      if (
        messagesResponse.data.messages &&
        messagesResponse.data.messages.length > 0
      ) {
        // Get the most recent message
        const latestMessage = messagesResponse.data.messages[0]
        if (latestMessage.id) {
          await logMessageDetails(gmail, latestMessage.id)
        }
      } else {
        console.log('No messages found in inbox.')
      }
    }
  } catch (error) {
    console.error('Error processing Gmail notification:', error)
  }
}

// Helper function to log message details consistently
async function logMessageDetails(gmail: any, messageId: string) {
  try {
    const messageDetails = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'metadata', // Use 'full' to get body, 'metadata' for headers
      metadataHeaders: ['Subject', 'From'],
    })

    const subjectHeader = messageDetails.data.payload?.headers?.find(
      (h: any) => h.name === 'Subject'
    )
    const fromHeader = messageDetails.data.payload?.headers?.find(
      (h: any) => h.name === 'From'
    )

    const subject = subjectHeader?.value || 'No Subject'
    const from = fromHeader?.value || 'No Sender'

    console.log(`📧 New Email:`)
    console.log(`   From: ${from}`)
    console.log(`   Subject: ${subject}`)

    // TODO: Add your logic here!
    // - Parse the subject/sender to identify Prom/Rozetka orders
    // - Fetch full message body if needed
    // - Create an order in your database
  } catch (error) {
    console.error('Error fetching message details:', error)
  }
}
