import { Application } from 'express';
import cron from 'node-cron';
import { runMinAttendanceCheckJob } from './minAttendanceCheck.job';
import { runMonthlyReportReminderJob } from './monthlyReportReminder.job';

// Registers all scheduled background jobs. Call once from index.ts after `app.set('io', io)`.
export const registerScheduledJobs = (app: Application): void => {
  // Weekly min-attendance alert — every Monday at 08:00
  cron.schedule('0 8 * * 1', () => {
    runMinAttendanceCheckJob(app);
  });

  // Monthly report due reminder — 1st of each month at 08:00
  cron.schedule('0 8 1 * *', () => {
    runMonthlyReportReminderJob(app);
  });
};
