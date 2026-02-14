// server/src/jobs/gmailWatchCronJob.ts
import cron from 'node-cron'
import { restartGmailWatch } from '../services/gmail/gmailService'

/**
 * Renew Gmail watch subscription
 * Gmail watch expires after 7 days, so we renew it every 6 days to be safe
 */
async function renewGmailWatch() {
  const startTime = Date.now()
  console.log('🔄 [CRON] Starting Gmail watch renewal...')

  try {
    const watchData = await restartGmailWatch()

if (!watchData) {
  console.warn('⚠️  [CRON] Gmail watch renewal returned no data')
  return
}

    const duration = Date.now() - startTime
    console.log(`✅ [CRON] Gmail watch renewed successfully in ${duration}ms`)

    if (watchData.expiration) {
      console.log(
        `📧 [CRON] Watch expires at: ${new Date(Number(watchData.expiration)).toLocaleString()}`,
      )
    }
  } catch (error: any) {
    console.error('❌ [CRON] Gmail watch renewal failed:', error.message)
  }
}

/**
 * Schedule the cron job to renew Gmail watch every 6 days
 *
 * Cron expression: '0 0 *\/6 * *'
 * - '0' - at minute 0
 * - '0' - at hour 0 (midnight)
 * - '*\/6' - every 6 days
 * - '* *' - every month, every day of week
 *
 * This will run every 6 days at midnight
 */
export function startGmailWatchCronJob() {
  // Schedule to run every 6 days at midnight
  const job = cron.schedule('0 0 */6 * *', async () => {
    console.log('\n🕒 [CRON] Scheduled Gmail watch renewal triggered')
    await renewGmailWatch()
  })

  console.log('✅ [CRON] Gmail watch renewal cron job initialized')
  console.log('⏰ [CRON] Will renew Gmail watch every 6 days at midnight')

  // Run immediately on startup to ensure watch is active
  console.log('🚀 [CRON] Running initial Gmail watch renewal...')
  renewGmailWatch()

  return job
}

/**
 * Stop the cron job (useful for cleanup)
 */
export function stopGmailWatchCronJob(job: cron.ScheduledTask) {
  job.stop()
  console.log('🛑 [CRON] Gmail watch renewal cron job stopped')
}

// Export the renewal function for manual triggers if needed
export { renewGmailWatch }
