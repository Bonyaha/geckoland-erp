// server/src/index.ts
import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cron from 'node-cron'
import { config } from './config/environment'
import { restartGmailWatch } from './services/gmail/gmailService'
import routes from './routes/index'

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

/* GMAIL WATCH RENEWAL SCHEDULER */
// This schedule runs at 2:00 AM every day. This doesn't handle authentication - it only renews the Gmail watch subscription (which expires every 7 days).
cron.schedule('0 2 * * *', () => {
  console.log('🤖 Running scheduled job to restart Gmail watch...')
  restartGmailWatch()
    .then((result) => {
      if (result) {
        console.log(
          '✅ Gmail watch renewed successfully. Expires:',
          new Date(parseInt(result.expiration || '0')),
        )
      } else {
        console.log('⏭️  Gmail watch not started - no valid token available')
      }
    })
    .catch((error) => {
      console.error(
        '🤖 Failed to restart Gmail watch automatically:',
        error.message,
      )
    })
})

/* SERVER */
const port = config.app.port
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`)
  console.log(`🌍 Environment: ${config.app.env}`)

  // Initialize all cron jobs after server starts
  initializeCronJobs()
})

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  console.log('\n⚠️  SIGTERM signal received: closing HTTP server')
  
  // Stop all cron jobs first
  stopAllCronJobs()
  
  // Then close the server
  server.close(() => {
    console.log('✅ HTTP server closed')
    process.exit(0)
  })
})

process.on('SIGINT', async () => {
  console.log('\n⚠️  SIGINT signal received: closing HTTP server')
  
  // Stop all cron jobs first
  stopAllCronJobs()
  
  // Then close the server
  server.close(() => {
    console.log('✅ HTTP server closed')
    process.exit(0)
  })
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
  
  // Stop cron jobs and exit
  stopAllCronJobs()
  process.exit(1)
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
  
  // Stop cron jobs and exit
  stopAllCronJobs()
  process.exit(1)
})

export default app