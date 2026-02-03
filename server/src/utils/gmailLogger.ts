// server/src/utils/gmailLogger.ts
import * as fs from 'fs'
import * as path from 'path'

/**
 * Dedicated logger for Gmail notification processing
 * Writes all Gmail-related logs to a separate file for easy debugging
 */

const LOG_DIR = path.join(process.cwd(), 'logs')
const LOG_FILE = path.join(LOG_DIR, 'gmail-notifications.log')
const MAX_LOG_SIZE = 5 * 1024 * 1024 // 5MB
const BACKUP_COUNT = 3 // Keep last 3 log files

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

/**
 * Rotate log file if it exceeds max size
 */
function rotateLogIfNeeded() {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const stats = fs.statSync(LOG_FILE)

      if (stats.size >= MAX_LOG_SIZE) {
        // Rotate existing backup files
        for (let i = BACKUP_COUNT - 1; i >= 1; i--) {
          const oldFile = `${LOG_FILE}.${i}`
          const newFile = `${LOG_FILE}.${i + 1}`

          if (fs.existsSync(oldFile)) {
            if (i === BACKUP_COUNT - 1) {
              fs.unlinkSync(oldFile) // Delete oldest backup
            } else {
              fs.renameSync(oldFile, newFile)
            }
          }
        }

        // Move current log to .1
        fs.renameSync(LOG_FILE, `${LOG_FILE}.1`)
      }
    }
  } catch (error) {
    console.error('Error rotating log file:', error)
  }
}

/**
 * Format timestamp for logs
 */
function getTimestamp(): string {
  const now = new Date()
  return now.toISOString()
}

/**
 * Write log entry to file
 */
function writeLog(level: string, message: string, data?: any) {
  try {
    rotateLogIfNeeded()

    const timestamp = getTimestamp()
    let logEntry = `[${timestamp}] [${level}] ${message}`

    if (data !== undefined) {
      if (typeof data === 'object') {
        logEntry += '\n' + JSON.stringify(data, null, 2)
      } else {
        logEntry += ' ' + String(data)
      }
    }

    logEntry += '\n' + '='.repeat(80) + '\n'

    fs.appendFileSync(LOG_FILE, logEntry)
  } catch (error) {
    console.error('Failed to write to log file:', error)
  }
}

/**
 * Gmail Logger Interface
 */
export const gmailLogger = {
  /**
   * Log notification received
   */
  notificationReceived(historyId: string) {
    const msg = '📬 Gmail notification received'
    writeLog('INFO', msg, { historyId })
    console.log(`${msg} - historyId: ${historyId}`)
  },

  /**
   * Log message processing start
   */
  messageProcessingStart(messageId: string, labelName: string) {
    const msg = `🔍 Processing message`
    writeLog('INFO', msg, { messageId, label: labelName })
    console.log(`${msg} - ID: ${messageId}, Label: ${labelName}`)
  },

  /**
   * Log full email details
   */
  emailDetails(details: {
    messageId: string
    labelName: string
    subject: string
    body: string
    internalDate?: string
  }) {
    const msg = '📧 Email details'
    writeLog('INFO', msg, {
      messageId: details.messageId,
      label: details.labelName,
      subject: details.subject,
      bodyPreview: details.body.substring(0, 300) + '...',
      bodyLength: details.body.length,
      date: details.internalDate,
    })

    console.log(`\n${'='.repeat(60)}`)
    console.log(`📧 EMAIL RECEIVED`)
    console.log(`${'='.repeat(60)}`)
    console.log(`Label: ${details.labelName}`)
    console.log(`Subject: ${details.subject}`)
    console.log(`Body preview: ${details.body.substring(0, 150)}...`)
    console.log(`${'='.repeat(60)}\n`)
  },

  /**
   * Log pattern matching results
   */
  patternMatch(
    marketplace: string,
    patterns: {
      pattern1?: boolean
      pattern2?: boolean
      bodyHasOrder?: boolean
      matched: boolean
    },
  ) {
    const msg = `🔎 Pattern matching for ${marketplace}`
    writeLog('INFO', msg, patterns)

    if (patterns.matched) {
      console.log(`✅ ${msg} - MATCHED`)
    } else {
      console.log(`❌ ${msg} - NO MATCH`)
      console.log(`   Pattern checks:`, patterns)
    }
  },

  /**
   * Log order detection
   */
  orderDetected(marketplace: string, subject: string) {
    const msg = `🎯 NEW ORDER DETECTED on ${marketplace}!`
    writeLog('SUCCESS', msg, { marketplace, subject })
    console.log(`\n${'*'.repeat(60)}`)
    console.log(msg)
    console.log(`Subject: ${subject}`)
    console.log(`${'*'.repeat(60)}\n`)
  },

  /**
   * Log order processing start
   */
  orderProcessingStart(marketplace: string) {
    const msg = `⚙️ Starting order processing for ${marketplace}`
    writeLog('INFO', msg)
    console.log(msg)
  },

  /**
   * Log order processing result
   */
  orderProcessingResult(
    marketplace: string,
    result: {
      created: number
      skipped: number
      errors: number
    },
  ) {
    const msg = `📊 Order processing completed for ${marketplace}`
    writeLog('INFO', msg, result)

    console.log(`\n${'='.repeat(60)}`)
    console.log(msg)
    console.log(`Created: ${result.created}`)
    console.log(`Skipped: ${result.skipped}`)
    console.log(`Errors: ${result.errors}`)
    console.log(`${'='.repeat(60)}\n`)
  },

  /**
   * Log order processing error
   */
  orderProcessingError(marketplace: string, error: any) {
    const msg = `❌ Order processing FAILED for ${marketplace}`
    const errorData = {
      marketplace,
      error: error.message || String(error),
      stack: error.stack,
    }
    writeLog('ERROR', msg, errorData)
    console.error(msg)
    console.error('Error:', error.message || error)
  },

  /**
   * Log message already processed (skipped)
   */
  messageSkipped(messageId: string, reason: string) {
    const msg = `⏭️ Message skipped`
    writeLog('INFO', msg, { messageId, reason })
    console.log(`${msg} - ${messageId} (${reason})`)
  },

  /**
   * Log message marked as read
   */
  messageMarkedRead(messageId: string) {
    const msg = `✓ Message marked as read`
    writeLog('INFO', msg, { messageId })
    console.log(`${msg} - ${messageId}`)
  },

  /**
   * Log error during message processing
   */
  processingError(messageId: string, error: any) {
    const msg = `💥 Error processing message`
    const errorData = {
      messageId,
      error: error.message || String(error),
      stack: error.stack,
    }
    writeLog('ERROR', msg, errorData)
    console.error(`${msg} - ${messageId}`)
    console.error('Error:', error)
  },

  /**
   * Log summary of notification processing
   */
  processingSummary(summary: {
    totalMessages: number
    processed: number
    skipped: number
    errors: number
    duration: number
  }) {
    const msg = '✅ Notification processing complete'
    writeLog('INFO', msg, summary)

    console.log(`\n${'='.repeat(60)}`)
    console.log(msg)
    console.log(`Total messages: ${summary.totalMessages}`)
    console.log(`Processed: ${summary.processed}`)
    console.log(`Skipped: ${summary.skipped}`)
    console.log(`Errors: ${summary.errors}`)
    console.log(`Duration: ${summary.duration}ms`)
    console.log(`${'='.repeat(60)}\n`)
  },

  /**
   * Log critical error
   */
  criticalError(context: string, error: any) {
    const msg = `🚨 CRITICAL ERROR in ${context}`
    const errorData = {
      context,
      error: error.message || String(error),
      stack: error.stack,
    }
    writeLog('CRITICAL', msg, errorData)
    console.error(`\n${'!'.repeat(60)}`)
    console.error(msg)
    console.error('Error:', error)
    console.error(`${'!'.repeat(60)}\n`)
  },

  /**
   * Log general info
   */
  info(message: string, data?: any) {
    writeLog('INFO', message, data)
    console.log(message, data || '')
  },

  /**
   * Log warning
   */
  warn(message: string, data?: any) {
    writeLog('WARN', message, data)
    console.warn(message, data || '')
  },

  /**
   * Log debug info
   */
  debug(message: string, data?: any) {
    writeLog('DEBUG', message, data)
    console.log(`[DEBUG] ${message}`, data || '')
  },

  /**
   * Get log file path for user reference
   */
  getLogFilePath(): string {
    return LOG_FILE
  },

  /**
   * Clear old log file (for maintenance)
   */
  clearLogs() {
    try {
      if (fs.existsSync(LOG_FILE)) {
        fs.unlinkSync(LOG_FILE)
        writeLog('INFO', 'Log file cleared')
      }
    } catch (error) {
      console.error('Failed to clear log file:', error)
    }
  },
}

// Log that the logger has been initialized
writeLog('INFO', '🚀 Gmail notification logger initialized', {
  logFile: LOG_FILE,
  maxSize: `${MAX_LOG_SIZE / 1024 / 1024}MB`,
  backupCount: BACKUP_COUNT,
})

export default gmailLogger
