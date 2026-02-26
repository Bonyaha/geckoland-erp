// server/src/index.ts
import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { config } from './config/environment'
import routes from './routes/index'
import fs from 'fs'
import path from 'path'
/* MIDDLEWARE IMPORTS */
import { errorHandler, notFoundHandler, requestLogger } from './middleware'

/* CRON JOBS */
import { initializeCronJobs, stopAllCronJobs } from './jobs'

/* CONFIGURATIONS */
const app = express()

/* MIDDLEWARE */
// Security & parsing
app.use(express.json())
app.use(helmet())
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cors())

// Logging
app.use(morgan('common'))
app.use(requestLogger) // Custom enhanced logging

/* ROUTES */
app.use('/', routes) // Mount all routes through central router

/* ERROR HANDLING */
// 404 handler (must be after all routes)
app.use(notFoundHandler)

// Global error handler (must be last)
app.use(errorHandler)

/* SERVER */
const port = config.app.port
// File-based flag to track cron initialization across nodemon restarts
const CRON_FLAG_FILE = path.join(process.cwd(), '.cron-initialized')

/**
 * Check if cron jobs have already been initialized in this dev session
 * The flag persists across nodemon restarts until Ctrl+C is pressed
 */

function isCronAlreadyInitialized(): boolean {
  try {
    return fs.existsSync(CRON_FLAG_FILE)
  } catch (error) {
    console.error('Error checking cron flag:', error)
    return false
  }
}

/**
 * Mark cron jobs as initialized
 */
function markCronInitialized(): void {
  try {
    fs.writeFileSync(
      CRON_FLAG_FILE,
      JSON.stringify({
        initialized: new Date().toLocaleString('en-US', {
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
        note: 'This flag prevents cron job re-initialization across nodemon restarts. Deleted on Ctrl+C.',
      }),
    )
  } catch (error) {
    console.error('Error writing cron flag:', error)
  }
}

/**
 * Clean up cron flag on exit
 */
function cleanupCronFlag(): void {
  try {
    if (fs.existsSync(CRON_FLAG_FILE)) {
      fs.unlinkSync(CRON_FLAG_FILE)
      console.log('🧹 Cleaned up cron flag file')
    }
  } catch (error) {
    console.error('Error cleaning up cron flag:', error)
  }
}

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`)
  console.log(`🌍 Environment: ${config.app.env}`) 

  // Only initialize cron jobs once, even across nodemon reloads
  if (!isCronAlreadyInitialized()) {
    console.log(
      '🔄 First start of dev session - will initialize cron jobs in 10 seconds',
    )
    setTimeout(() => {
      initializeCronJobs()
      markCronInitialized()
      console.log('✅ Cron jobs initialized successfully')
    }, 10_000)
  } else {
    console.log(
      '⏭️  Skipping cron job initialization (nodemon restart - cron jobs already running)',
    )
  }
})

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  console.log('\n⚠️  SIGTERM signal received: closing HTTP server')

  // Stop all cron jobs
  stopAllCronJobs()

  // In development, clean up flag so next npm run dev initializes cron
  if (config.app.isDevelopment) {
    cleanupCronFlag()
  }

  // Close the server
  server.close(() => {
    console.log('✅ HTTP server closed')
    process.exit(0)
  })
})

process.on('SIGINT', async () => {
  console.log('\n⚠️  SIGINT signal received: closing HTTP server')

  // Stop all cron jobs
  stopAllCronJobs()

  // In development, clean up flag so next npm run dev initializes cron
  if (config.app.isDevelopment) {
    cleanupCronFlag()
  }

  // Close the server
  server.close(() => {
    console.log('✅ HTTP server closed')
    process.exit(0)
  })
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)

  // Stop cron jobs
  stopAllCronJobs()

  // Clean up in development
  if (config.app.isDevelopment) {
    cleanupCronFlag()
  }

  process.exit(1)
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)

  // Stop cron jobs
  stopAllCronJobs()

  // Clean up in development
  if (config.app.isDevelopment) {
    cleanupCronFlag()
  }

  process.exit(1)
})

export default app
