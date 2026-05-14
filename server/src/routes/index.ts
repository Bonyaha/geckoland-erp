// server/src/routes/index.ts
import { Router } from 'express'
import dashboardRoutes from './dashboardRoutes'
import productRoutes from './productRoutes'
import userRoutes from './userRoutes'
import expenseRoutes from './expenseRoutes'
import notificationRoutes from './notificationRoutes'
import gmailRoutes from './gmailRoutes'
import authRoutes from './authRoutes'
import orderRoutes from './orderRoutes'
import trackingRoutes from './trackingRoutes'
import salesRoutes from './salesRoutes'
import clientRoutes from './clientRoutes'
import settingsRoutes from './settingsRoutes'
import { authenticate } from '../middleware/auth'

const router = Router()

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

/**
 * Welcome endpoint
 */
router.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the ERP API',
    version: '1.0.0',
    endpoints: {
      dashboard: '/api/dashboard',
      products: '/api/products',
      users: '/api/users',
      expenses: '/api/expenses',
      notifications: '/api/notifications',
      gmail: '/api/gmail',
      auth: '/api/auth',
      orders: '/api/orders',
      tracking: '/api/tracking',
      sales: '/api/sales',
      clients: '/api/clients',
      settings: '/api/settings',
    },
  })
})

// Auth routes — PUBLIC (no token needed)
router.use('/api/auth', authRoutes)

// Gmail webhook — PUBLIC (Google calls this, can't send a token)
router.use('/api/notifications', notificationRoutes)
router.use('/api/gmail', gmailRoutes)

//NEW: Apply authentication to all routes below this line
router.use(authenticate)


/**
 * Mount all route modules
 */
router.use('/api/dashboard', dashboardRoutes)
router.use('/api/products', productRoutes)
router.use('/api/users', userRoutes)
router.use('/api/expenses', expenseRoutes)
router.use('/api/orders', orderRoutes)
router.use('/api/tracking', trackingRoutes)
router.use('/api/sales', salesRoutes)
router.use('/api/clients', clientRoutes)
router.use('/api/settings', settingsRoutes)

/**
 * 404 handler for undefined routes
 */
router.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      '/api/dashboard',
      '/api/products',
      '/api/users',
      '/api/expenses',
      '/api/notifications',
      '/api/gmail',
      '/api/auth',
      '/api/orders',
      '/api/tracking',
      '/api/sales',
      '/api/clients',
      '/api/settings',
    ],
  })
})

export default router
