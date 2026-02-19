// server/src/jobs/index.ts
import cron from 'node-cron'
import { startTrackingStatusCronJob } from './trackingStatusCronJob'
import { startGmailWatchCronJob } from './gmailWatchCronJob'

/**
 * Collection of all active cron jobs
 */
const activeCronJobs: cron.ScheduledTask[] = []

/**
 * Initialize and start all cron jobs
 * Call this function from your main server file (index.ts)
 */
export function initializeCronJobs() {
  console.log('\n🚀 [CRON] Initializing all cron jobs...\n')

  try {
    // 1. Start tracking status update cron job (every 6 hours)
    const trackingJob = startTrackingStatusCronJob()
    activeCronJobs.push(trackingJob)

    // 2. Start Gmail watch renewal cron job (every 6 days)
    // Delay Gmail watch renewal to avoid competing with startup webhook processing
    setTimeout(() => {
      const gmailJob = startGmailWatchCronJob()
      activeCronJobs.push(gmailJob)
    }, 15000) // 15 second delay

    console.log(
      `\n✅ [CRON] All cron jobs initialized successfully (${activeCronJobs.length} jobs active)\n`,
    )
  } catch (error) {
    console.error('❌ [CRON] Failed to initialize cron jobs:', error)
  }
}

/**
 * Stop all active cron jobs
 * Call this when shutting down the server
 */
export function stopAllCronJobs() {
  console.log('\n🛑 [CRON] Stopping all cron jobs...')

  activeCronJobs.forEach((job, index) => {
    try {
      job.stop()
      console.log(`✅ [CRON] Stopped cron job ${index + 1}`)
    } catch (error) {
      console.error(`❌ [CRON] Failed to stop cron job ${index + 1}:`, error)
    }
  })

  activeCronJobs.length = 0 // Clear the array
  console.log('✅ [CRON] All cron jobs stopped\n')
}

/**
 * Get status of all cron jobs
 */
export function getCronJobsStatus() {
  return {
    totalJobs: activeCronJobs.length,
    jobs: [
      {
        name: 'Tracking Status Update',
        schedule:
          'Every 6 hours (00:00, 06:00, 12:00, 18:00)',
        description:
          'Automatically checks and updates delivery tracking statuses from Nova Poshta',
        active: activeCronJobs.length > 0,
      },
      {
        name: 'Gmail Watch Renewal',
        schedule: 'Every 6 days at midnight',
        description: 'Renews Gmail push notification watch subscription',
        active: activeCronJobs.length > 1,
      },
    ],
  }
}
