// server/src/controllers/notificationController.ts
// This is the webhook that Google Pub/Sub will call.
import { Request, Response } from 'express'
import { google } from 'googleapis'
import { authorize } from '../../services/gmail/gmailService'
import type { gmail_v1 } from 'googleapis'
import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'
import OrderService from '../../services/orders/orderService'
import { gmailLogger } from '../../utils/gmailLogger'

// Initialize order service
const orderService = new OrderService()

// --- ENHANCED: Paths and data structures ---
const HISTORY_PATH = path.join(
  process.cwd(),
  'src',
  'storage',
  'gmail-history.json',
)
const PROCESSED_MESSAGES_PATH = path.join(
  process.cwd(),
  'src',
  'storage',
  'processed-messages.json',
)

// In-memory cache for recently processed messages (prevents duplicates within same session)
const recentlyProcessed = new Set<string>()
let labelIdMap: Map<string, string> | null = null

// Concurrency control - prevent multiple simultaneous processing
let isProcessing = false
const processingQueue: Array<() => Promise<void>> = []

/**
 * Load processed message IDs from persistent storage
 */
async function loadProcessedMessages(): Promise<Set<string>> {
  try {
    const content = await fs.readFile(PROCESSED_MESSAGES_PATH)
    const data = JSON.parse(content.toString())
    return new Set(data.messageIds || [])
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as any).code === 'ENOENT'
    ) {
      return new Set<string>()
    }
    throw error
  }
}

/**
 * Save processed message IDs to persistent storage
 * Keep only last 1000 messages to prevent file from growing indefinitely
 */
async function saveProcessedMessages(messageIds: Set<string>): Promise<void> {
  const idsArray = Array.from(messageIds)
  // Keep only the last 1000 messages to prevent memory/storage bloat
  const recentIds = idsArray.slice(-1000)
  await fs.writeFile(
    PROCESSED_MESSAGES_PATH,
    JSON.stringify({ messageIds: recentIds }),
  )
}

/**
 * Load the last known history ID from a file
 */
async function loadLastHistoryId(): Promise<string | null> {
  try {
    const content = await fs.readFile(HISTORY_PATH)
    const data = JSON.parse(content.toString())
    return data.historyId
  } catch (error: unknown) {
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
 * Save the latest history ID to a file
 */
async function saveLastHistoryId(historyId: string): Promise<void> {
  await fs.writeFile(HISTORY_PATH, JSON.stringify({ historyId }))
}

/**
 * Fetches and caches the mapping of label names to label IDs
 */
async function initializeLabelCache() {
  if (labelIdMap) return

  gmailLogger.info('Initializing label cache...')
  const labelNames = ['Prom', 'Rozetka', 'Personal']
  const auth = await authorize()
  const gmail = google.gmail({ version: 'v1', auth })
  const response = await gmail.users.labels.list({ userId: 'me' })
  const labels = response.data.labels || []

  //console.log('labels from response are: ', labels);

  labelIdMap = new Map()
  for (const labelName of labelNames) {
    const foundLabel = labels.find(
      (l) => l.name?.toLowerCase() === labelName.toLowerCase(),
    )
    if (foundLabel && foundLabel.id) {
      labelIdMap.set(foundLabel.id, labelName)
    }
  }
  gmailLogger.info('Label cache initialized', Object.fromEntries(labelIdMap))
}

/**
 * Decodes the body of a Gmail message part
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
 * Create a unique fingerprint for a message based on subject and timestamp
 */
function createMessageFingerprint(
  subject: string,
  internalDate: string,
): string {
  return crypto
    .createHash('md5')
    .update(`${subject}-${internalDate}`)
    .digest('hex')
}

/**
 * Handle new order creation from different marketplaces
 */
async function handleNewOrder(marketplace: string): Promise<void> {
  try {
    gmailLogger.orderProcessingStart(marketplace)

    if (marketplace === 'Prom') {
      const result = await orderService.fetchAndCreateNewPromOrders()
      gmailLogger.orderProcessingResult(marketplace, result)

      if (result.created > 0) {
        gmailLogger.info(
          `Successfully created ${result.created} new orders from Prom`,
        )
      } else if (result.skipped > 0) {
        gmailLogger.info(
          `All ${result.skipped} orders from Prom were already processed`,
        )
      }

      if (result.errors > 0) {
        gmailLogger.warn(
          `${result.errors} errors occurred while processing Prom orders`,
        )
      }
    } else if (marketplace === 'Rozetka') {
      const result = await orderService.fetchAndCreateNewRozetkaOrders()
      gmailLogger.orderProcessingResult(marketplace, result)

      if (result.created > 0) {
        gmailLogger.info(
          `Successfully created ${result.created} new orders from Rozetka`,
        )
      } else if (result.skipped > 0) {
        gmailLogger.info(
          `All ${result.skipped} orders from Rozetka were already processed`,
        )
      }

      if (result.errors > 0) {
        gmailLogger.warn(
          `${result.errors} errors occurred while processing Rozetka orders`,
        )
      }
    } else if (marketplace === 'Website') {
      gmailLogger.info('Website order processing not yet implemented')
      // TODO: Implement Website order processing
    }
  } catch (error) {
    gmailLogger.orderProcessingError(marketplace, error)
    throw error
  }
}

/**
 * Process a single message (extracted for reusability)
 */
async function processMessage(
  messageId: string,
  gmail: gmail_v1.Gmail,
  processedMessages: Set<string>,
): Promise<boolean> {
  gmailLogger.debug(`Processing message ${messageId}`)

  // Check if already processed (both in-memory and persistent cache)
  if (recentlyProcessed.has(messageId) || processedMessages.has(messageId)) {
    gmailLogger.messageSkipped(messageId, 'Already processed')
    return false
  }

  const messageDetails = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  })

  const { payload, labelIds, internalDate } = messageDetails.data
  if (!payload || !labelIds) return false

  // Create message fingerprint for additional deduplication
  const headers = payload.headers || []
  const subject =
    headers.find((h) => h.name === 'Subject')?.value || 'No Subject'
  const fingerprint = createMessageFingerprint(subject, internalDate || '')

  if (
    recentlyProcessed.has(fingerprint) ||
    processedMessages.has(fingerprint)
  ) {
    gmailLogger.messageSkipped(messageId, 'Duplicate fingerprint.Skipping.')
    return false
  }

  // Check if the message has one of our target labels
  const relevantLabelId = labelIds.find((id) => labelIdMap!.has(id))
  if (!relevantLabelId) {
    gmailLogger.messageSkipped(messageId, 'No relevant label. Skipping.')
    return false
  }

  const labelName = labelIdMap!.get(relevantLabelId)
  gmailLogger.messageProcessingStart(messageId, labelName!)

  const body = getPartText(payload)

  // Log full email details
  gmailLogger.emailDetails({
    messageId,
    labelName: labelName!,
    subject,
    body,
    internalDate: internalDate || undefined,
  })

  // Business logic for different labels
  if (labelName === 'Prom') {
    // Pattern 1: "+1 замовлення [NUMBER] вже в кабінеті"
    const pattern1 = /\+\d+\s+замовлення\s+\d+\s+вже\s+в\s+кабінеті/i.test(
      subject,
    )

    // Pattern 2: "У вас нове замовлення"
    const pattern2 = subject.includes('У вас нове замовлення')

    // Body should contain order reference
    const bodyHasOrder =
      body.includes('У вас нове замовлення') ||
      body.includes('замовлення') ||
      /замовлення\s+\d+/i.test(body)

    const matched = (pattern1 || pattern2) && bodyHasOrder

    // Log pattern matching results
    gmailLogger.patternMatch('Prom', {
      pattern1,
      pattern2,
      bodyHasOrder,
      matched,
    })
    if (matched) {
      gmailLogger.orderDetected('Prom', subject)

      try {
        await handleNewOrder('Prom')
      } catch (error) {
        gmailLogger.orderProcessingError('Prom', error)
      }
    } else {
      gmailLogger.info(
        'Prom email received but not identified as order notification',
      )
    }
  } else if (labelName === 'Rozetka') {
    const subjectMatch = subject.includes('Надійшло замовлення №')
    const bodyMatch = body.includes('Вам надійшло нове замовлення!')
    const matched = subjectMatch && bodyMatch

    // Log pattern matching results
    gmailLogger.patternMatch('Rozetka', {
      pattern1: subjectMatch,
      pattern2: bodyMatch,
      matched,
    })

    if (matched) {
      gmailLogger.orderDetected('Rozetka', subject)
      try {
        await handleNewOrder('Rozetka')
      } catch (error) {
        gmailLogger.orderProcessingError('Rozetka', error)
        // Don't throw error to continue processing other messages
      }
    } else {
      gmailLogger.info(
        'Rozetka email received but not identified as order notification',
      )
    }
  }

  // Mark as read
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { removeLabelIds: ['UNREAD'] },
  })
  gmailLogger.messageMarkedRead(messageId)

  // Mark as processed (both message ID and fingerprint)
  recentlyProcessed.add(messageId)
  recentlyProcessed.add(fingerprint)
  processedMessages.add(messageId)
  processedMessages.add(fingerprint)

  return true
}

/**
 * Main processing function (extracted for queue handling)
 */
async function processNotification(req: Request): Promise<void> {
  gmailLogger.info('Processing Gmail notification')

  await initializeLabelCache()
  if (!labelIdMap) throw new Error('Label cache is not initialized.')

  const pubSubMessage = req.body.message
  if (!pubSubMessage || !pubSubMessage.data) {
    gmailLogger.warn('Received an invalid Pub/Sub message')
    return
  }

  const decodedData = JSON.parse(
    Buffer.from(pubSubMessage.data, 'base64').toString('utf-8'),
  )
  const newHistoryId = decodedData.historyId

  // Load processed messages and last history ID
  const processedMessages = await loadProcessedMessages()
  const lastHistoryId = await loadLastHistoryId()

  // If this is the first ever notification
  if (!lastHistoryId) {
    await saveLastHistoryId(newHistoryId)
    gmailLogger.info(
      'First run: Stored initial history ID. Will process new messages on the next notification.',
    )
    // No emails are processed or logged in this case, ensuring non-labeled emails are ignored
    return
  }

  // Strict check for non-newer historyId (handles out-of-order or duplicates)
  const lastNum = parseInt(lastHistoryId, 10)
  const newNum = parseInt(newHistoryId, 10)
  if (isNaN(lastNum) || isNaN(newNum) || newNum <= lastNum) {
    gmailLogger.info(
      `History ID ${newHistoryId} is not newer than last ${lastHistoryId}. Skipping.`,
    )
    return
  }

  const auth = await authorize()
  const gmail = google.gmail({ version: 'v1', auth })

  // Fetch the history of changes since the last notification
  const historyResponse = await gmail.users.history.list({
    userId: 'me',
    startHistoryId: lastHistoryId,
    historyTypes: ['messageAdded'],
  })

  const historyRecords = historyResponse.data.history
  if (!historyRecords || historyRecords.length === 0) {
    gmailLogger.info('No new messages found in history since last check')
    await saveLastHistoryId(newHistoryId)
    return
  }

  let processedCount = 0
  let skippedCount = 0
  let errorCount = 0
  const uniqueMessageIds = new Set<string>()

  // Collect all unique message IDs first (deduplication at collection level)
  for (const record of historyRecords) {
    if (!record.messagesAdded) continue

    for (const messageAdded of record.messagesAdded) {
      const message = messageAdded.message
      if (!message?.id || !message.labelIds) continue

      // Check if the message has a relevant label before adding to process
      const hasRelevantLabel = message.labelIds.some((id) =>
        labelIdMap!.has(id),
      )
      if (hasRelevantLabel) {
        uniqueMessageIds.add(message.id)
      }
    }
  }
  if (uniqueMessageIds.size === 0) {
    gmailLogger.info('No relevant messages found to process')
    await saveLastHistoryId(newHistoryId)
    return
  }

  gmailLogger.info(`Found ${uniqueMessageIds.size} unique messages to process`)

  // Process each unique message
  for (const messageId of uniqueMessageIds) {
    try {
      const wasProcessed = await processMessage(
        messageId,
        gmail,
        processedMessages,
      )
      if (wasProcessed) {
        processedCount++
      } else {
        skippedCount++
      }
    } catch (error: any) {
      errorCount++
      if (error.code === 404) {
        console.log(
          `Message ${messageId} not found (possibly deleted). Skipping.`,
        )
        gmailLogger.messageSkipped(
          messageId,
          'Message not found (deleted).Skipping.',
        )
      } else {
        gmailLogger.processingError(messageId, error)
      }
      // Continue processing other messages even if one fails
    }
  }

  // Save state
  await saveProcessedMessages(processedMessages)
  await saveLastHistoryId(newHistoryId)

  // Log processing summary
  const summary = {
    totalMessages: uniqueMessageIds.size,
    processed: processedCount,
    skipped: skippedCount,
    errors: errorCount,
    duration: 0, // Will be set by caller
  }

  if (processedCount > 0 || errorCount > 0) {
    gmailLogger.processingSummary(summary)
    gmailLogger.info(
      `Processed ${processedCount} messages, skipped ${skippedCount}, errors ${errorCount}.History ID updated to: ${newHistoryId}`,
    )
  }
}

/**
 * Queue processor for handling concurrent requests
 */
async function processQueue(): Promise<void> {
  while (processingQueue.length > 0) {
    const task = processingQueue.shift()
    if (task) {
      try {
        await task()
      } catch (error) {
        gmailLogger.criticalError('Queue processing', error)
      }
    }
  }
  isProcessing = false
}

/**
 * Main controller to handle incoming Pub/Sub notifications from Gmail
 */
export const handleGmailNotification = async (req: Request, res: Response) => {
  gmailLogger.info('=== Gmail notification webhook triggered ===')

  const startTime = Date.now()

  // Acknowledge immediately to prevent retries
  res.status(204).send()

  // Add to processing queue to handle concurrency
  const task = () => processNotification(req)

  if (isProcessing) {
    // If already processing, add to queue
    processingQueue.push(task)
    gmailLogger.info(
      `⏳ Added notification to queue. Queue length: ${processingQueue.length}`,
    )
    return
  }

  // Start processing
  isProcessing = true
  try {
    await task()
    const duration = Date.now() - startTime
    gmailLogger.info(`✅ Notification processed successfully in ${duration}ms`)
  } catch (error) {
    const duration = Date.now() - startTime
    gmailLogger.criticalError(
      `Notification processing after ${duration}ms`,
      error,
    )
  } finally {
    // Process any queued items
    if (processingQueue.length > 0) {
      setImmediate(() => processQueue())
    } else {
      isProcessing = false
    }
  }
}
