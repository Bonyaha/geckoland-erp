import dotenv from 'dotenv'
import cron from 'node-cron'
import app from './app'
import { restartGmailWatch } from './modules/auth'

dotenv.config()

const port = Number(process.env.PORT) || 3001

/* GMAIL WATCH RENEWAL SCHEDULER */
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

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`)

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

export default server
