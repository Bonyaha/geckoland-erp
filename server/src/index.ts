// server/src/index.ts
import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { config } from './config/environment'
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

/* SERVER */
const port = config.app.port
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`)
  console.log(`🌍 Environment: ${config.app.env}`)

  // Initialize all cron jobs after server starts
  // Give the server 10 seconds to stabilize before starting cron jobs
  setTimeout(() => {
    initializeCronJobs()
  }, 10_000)
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