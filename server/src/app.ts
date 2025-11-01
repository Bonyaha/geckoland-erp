import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'

import dashboard from './modules/dashboard'
import products from './modules/products'
import users from './modules/users'
import expenses from './modules/expenses'
import notifications from './modules/notifications'
import auth from './modules/auth'
import orders from './modules/orders'
import tracking from './modules/tracking'

const app = express()

app.use(express.json())
app.use(helmet())
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }))
app.use(morgan('common'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cors())

app.use('/dashboard', dashboard)
app.use('/products', products)
app.use('/users', users)
app.use('/expenses', expenses)
app.use('/notifications', notifications)
app.use('/auth', auth)
app.use('/api/orders', orders)
app.use('/api/tracking', tracking)

app.get('/hello', (req, res) => {
  res.send('Welcome to the ERP server!')
})

export { app }
export default app
