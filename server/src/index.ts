// server/src/index.ts
import express from 'express'
import dotenv from 'dotenv'
import bodyParser from 'body-parser'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cron from 'node-cron'
import { restartGmailWatch } from './services/auth/gmailService'
/* ROUTE IMPORTS */
import dashboardRoutes from './routes/dashboardRoutes'
import productRoutes from './routes/productRoutes'
import userRoutes from './routes/userRoutes'
import expenseRoutes from './routes/expenseRoutes'
import notificationRoutes from './routes/notificationRoutes'
import authRoutes from './routes/authRoutes'
import orderRoutes from './routes/orderRoutes'
import trackingRoutes from './routes/trackingRoutes'

/* CONFIGURATIONS */
dotenv.config()
const app = express()
app.use(express.json())
app.use(helmet())
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }))
app.use(morgan('common'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cors())

/* ROUTES */
app.use('/dashboard', dashboardRoutes) // http://localhost:8001/dashboard
app.use('/products', productRoutes) // http://localhost:8001/products
app.use('/users', userRoutes) // http://localhost:8001/users
app.use('/expenses', expenseRoutes) // http://localhost:8001/expenses
app.use('/notifications', notificationRoutes) // http://localhost:8001/notifications/gmail
app.use('/auth', authRoutes) // http://localhost:8001/auth/gmail/auth
app.use('/api/orders', orderRoutes) // http://localhost:8001/api/orders
app.use('/api/tracking', trackingRoutes) // http://localhost:8001/api/tracking
app.get('/hello', (req, res) => {
  res.send('Welcome to the ERP server!')
})

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
const port = Number(process.env.PORT) || 3001
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`)

  // Also trigger a restart on server startup
  //console.log('Attempting to start/restart Gmail watch on server startup...')
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
