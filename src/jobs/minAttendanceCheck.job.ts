import { Application } from 'express';
import { runLowAttendanceCheck } from '../controllers/attendance.controller';

export const runMinAttendanceCheckJob = async (app: Application): Promise<void> => {
  try {
    const { threshold, totalChecked, belowThreshold } = await runLowAttendanceCheck(app);
    console.log(
      `📊 Min-attendance check: ${belowThreshold.length}/${totalChecked} members below ${threshold}% threshold, notified.`
    );
  } catch (error) {
    console.error('Min-attendance check job failed:', error);
  }
};
