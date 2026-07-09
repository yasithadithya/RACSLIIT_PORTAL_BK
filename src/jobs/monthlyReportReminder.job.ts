import { Application } from 'express';
import Role from '../models/Role';
import User from '../models/User';
import { notifyUser } from '../services/notification.service';

// Notifies Secretary-role users on the 1st of each month that the monthly report is due.
export const runMonthlyReportReminderJob = async (app: Application): Promise<void> => {
  try {
    const secretaryRole = await Role.findOne({ name: 'Secretary' });
    if (!secretaryRole) return;

    const secretaries = await User.find({ roleId: secretaryRole._id, status: 'active' });

    await Promise.all(
      secretaries.map((secretary) =>
        notifyUser(app, {
          userId: secretary._id,
          type: 'monthly_report_due',
          message: "This month's report is due — generate it from the Reports dashboard.",
        })
      )
    );

    console.log(`📋 Monthly report reminder sent to ${secretaries.length} Secretary user(s).`);
  } catch (error) {
    console.error('Monthly report reminder job failed:', error);
  }
};
