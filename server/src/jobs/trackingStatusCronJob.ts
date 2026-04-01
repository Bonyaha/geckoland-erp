// server/src/jobs/trackingStatusCronJob.ts
import cron from 'node-cron'
import { trackingService } from '../services/tracking/trackingService'

/**
 * Main function to check and update tracking statuses
 * This delegates to the shared TrackingService
 */
async function updateTrackingStatuses() {
  try {
    // Call the shared tracking service with '[CRON]' prefix for logs
    await trackingService.updateAllTrackingStatuses('[CRON]')
  } catch (error) {
    console.error('[CRON] ❌ Tracking status update failed:', error)
  }
}

/**
 * Schedule the cron job to run every 6 hours
 *
 * Cron expression: '0 *\/6 * * *'
 * - '0' - at minute 0 (start of the hour)
 * - '*\/6' - every 6 hours
 * - '* * *' - every day, every month, every day of week
 *
 * This will run at: 00:00, 06:00, 12:00, 18:00
 */
export function startTrackingStatusCronJob() {
  // Schedule to run every 6 hours
  const job = cron.schedule('0 */6 * * *', async () => {
    console.log('\n🕒 [CRON] Scheduled tracking status check triggered')
    await updateTrackingStatuses()
  })

  console.log('✅ [CRON] Tracking status cron job initialized')

  // Run after 2 minutes on startup to avoid competing with Gmail webhook processing
  const STARTUP_DELAY_MS = 2 * 60 * 1000
  console.log(`⏳ [CRON] Initial tracking check will run in 2 minutes...`)

  setTimeout(async () => {
    console.log('\n🚀 [CRON] Running delayed initial tracking status check...')
    await updateTrackingStatuses()
  }, STARTUP_DELAY_MS)

  return job
}

/**
 * Stop the cron job (useful for cleanup)
 */
export function stopTrackingStatusCronJob(job: cron.ScheduledTask) {
  job.stop()
  console.log('🛑 [CRON] Tracking status cron job stopped')
}

// Export the update function for manual triggers if needed
export { updateTrackingStatuses }
