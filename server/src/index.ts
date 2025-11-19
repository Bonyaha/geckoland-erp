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
import { errorHandler, notFoundHandler, requestLogger } from './middleware'


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
app.use(morgan('common'));
app.use(requestLogger); // Custom enhanced logging

/* ROUTES */
app.use('/', routes) // Mount all routes through central router


/* ERROR HANDLING */
// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

/* GMAIL WATCH RENEWAL SCHEDULER */
// This schedule runs at 2:00 AM every day. This doesn't handle authentication - it only renews the Gmail watch subscription (which expires every 7 days).
cron.schedule('0 2 * * *', () => {
  console.log('🤖 Running scheduled job to restart Gmail watch...')
  restartGmailWatch()
    .then((result) => {
      if (result) {
        console.log(
          '✅ Gmail watch renewed successfully. Expires:',
          new Date(parseInt(result.expiration || '0'))
        )
      } else {
        console.log('⏭️  Gmail watch not started - no valid token available')
      }
    })
    .catch((error) => {
      console.error(
        '🤖 Failed to restart Gmail watch automatically:',
        error.message
      )
    })
})

/* SERVER */
const port = config.app.port
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`)
  console.log(`📍 Environment: ${config.app.env}`)

  // Also trigger a restart on server startup
  console.log('Attempting to start/restart Gmail watch on server startup...')
  restartGmailWatch()
    .then((result) => {
      if (result) {
        console.log('✅ Initial Gmail watch started successfully')
      } else {
        console.log('⏭️  Gmail watch not started - authorization needed first')
      }
    })
    .catch((err) => {
      console.log('⏭️  Could not start initial watch:', err.message)
    })
})
