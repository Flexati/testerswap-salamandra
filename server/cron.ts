import cron, { ScheduledTask } from "node-cron";
import { triggerTimerExpiringNotifications } from "./db";

let cronJob: ScheduledTask | null = null;

/**
 * Start the cron job for timer_expiring notifications.
 * Runs every hour to check for tests ending within 24 hours
 * and notify enrolled testers.
 */
export function startCronJobs(): void {
  // Run every hour at minute 0 (e.g., 10:00, 11:00, 12:00...)
  cronJob = cron.schedule("0 * * * *", async () => {
    console.log("[cron] Running timer_expiring notification check...");
    try {
      await triggerTimerExpiringNotifications();
      console.log("[cron] timer_expiring check completed");
    } catch (err) {
      console.error("[cron] timer_expiring check failed:", err);
    }
  });

  console.log("[cron] Timer expiring notifications scheduled (every hour)");
}

/**
 * Stop the cron job (for graceful shutdown).
 */
export function stopCronJobs(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log("[cron] Stopped all cron jobs");
  }
}