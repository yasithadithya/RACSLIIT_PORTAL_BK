import { Request, Response, Application } from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import AttendanceRecord from '../models/AttendanceRecord';
import Event from '../models/Event';
import User from '../models/User';
import { AuthRequest } from '../middlewares/auth.middleware';
import { notifyUser } from '../services/notification.service';

// Generate a short-lived QR token for an event
export const generateQRToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: eventId } = req.params;
    // Allow custom expiry, default to 15s for high security in live events
    const expiresIn = req.query.expiresIn ? String(req.query.expiresIn) : '15s'; 
    
    const event = await Event.findById(eventId);
    if (!event) {
      res.status(404).json({ message: 'Event not found' });
      return;
    }

    // Verify event is currently active (optional strict check: could require now >= startTime && now <= endTime)
    const now = new Date();
    // For leniency, let's allow checkins 1 hour before and 1 hour after the event
    const startWindow = new Date(event.startTime);
    startWindow.setHours(startWindow.getHours() - 1);
    const endWindow = new Date(event.endTime);
    endWindow.setHours(endWindow.getHours() + 1);

    if (now < startWindow || now > endWindow) {
      res.status(400).json({ message: 'Event is not currently active for check-in' });
      return;
    }

    const token = jwt.sign(
      { eventId, type: 'attendance_qr' },
      process.env.JWT_SECRET!,
      { expiresIn: expiresIn as any }
    );

    res.json({ token, eventId, expiresIn });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

// Check-in using a QR token
export const checkIn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { qrToken } = req.body;
    const userId = req.user?._id;

    if (!qrToken) {
      res.status(400).json({ message: 'QR token is required' });
      return;
    }

    try {
      const decoded = jwt.verify(
        qrToken,
        process.env.JWT_SECRET!
      ) as { eventId: string; type: string };

      if (decoded.type !== 'attendance_qr') {
        throw new Error('Invalid token type');
      }

      // Check if already checked in
      const existingRecord = await AttendanceRecord.findOne({
        eventId: decoded.eventId,
        userId: userId,
      });

      if (existingRecord) {
        res.status(400).json({ message: 'You have already checked in for this event' });
        return;
      }

      const created = await AttendanceRecord.create({
        eventId: decoded.eventId,
        userId: userId,
        method: 'qr',
      });

      const record = await AttendanceRecord.findById(created._id)
        .populate('userId', 'firstName lastName profilePhotoUrl');

      res.status(201).json({ message: 'Check-in successful', record });
    } catch (tokenError) {
      res.status(400).json({ message: 'Invalid or expired QR code' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

// Get the current user's personal identity QR payload. The QR simply encodes the
// member's SLIIT index number (unique per student) — a short payload keeps the QR
// sparse and easy to scan, unlike the previous JWT-based codes.
export const getMyQrToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    res.json({ token: req.user.sliitIndex });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

// Organizer scans a member's personal QR code to mark that member's attendance
// for a specific event/meeting/project session.
export const scanMemberQr = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { eventId, qrToken } = req.body;

    if (!eventId || !qrToken) {
      res.status(400).json({ message: 'Event ID and QR token are required' });
      return;
    }

    const event = await Event.findById(eventId);
    if (!event) {
      res.status(404).json({ message: 'Event not found' });
      return;
    }

    // Member QRs now encode the SLIIT index directly. Older downloaded QRs contain a
    // signed JWT ({ userId, type: 'member_qr' }) — accept those too so saved codes keep working.
    let member = null;
    try {
      const decoded = jwt.verify(qrToken, process.env.JWT_SECRET!) as { userId: string; type: string };
      if (decoded.type !== 'member_qr') {
        res.status(400).json({ message: 'This QR code is not a member attendance code' });
        return;
      }
      member = await User.findById(decoded.userId);
    } catch {
      const sliitIndex = String(qrToken).trim();
      member = await User.findOne({ sliitIndex: { $regex: `^${sliitIndex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
    }

    if (!member) {
      res.status(404).json({ message: 'Member not found' });
      return;
    }

    const memberId = member._id as mongoose.Types.ObjectId;

    const existingRecord = await AttendanceRecord.findOne({ eventId, userId: memberId });
    if (existingRecord) {
      res.status(400).json({ message: `${member.firstName} ${member.lastName} is already checked in` });
      return;
    }

    const created = await AttendanceRecord.create({
      eventId,
      userId: memberId,
      method: 'qr',
      verifiedBy: req.user?._id,
    });

    const record = await AttendanceRecord.findById(created._id)
      .populate('userId', 'firstName lastName sliitIndex profilePhotoUrl');

    notifyUser(req.app, {
      userId: memberId,
      type: 'attendance_marked',
      message: `Your attendance was marked for "${event.title}".`,
    }).catch(() => {});

    res.status(201).json({ message: 'Attendance marked successfully', record });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

// Manual check-in by admin/executive
export const manualCheckIn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { eventId, userId } = req.body;

    if (!eventId || !userId) {
      res.status(400).json({ message: 'Event ID and User ID are required' });
      return;
    }

    const existingRecord = await AttendanceRecord.findOne({ eventId, userId });
    if (existingRecord) {
      res.status(400).json({ message: 'User is already checked in' });
      return;
    }

    const record = await AttendanceRecord.create({
      eventId,
      userId,
      method: 'manual',
      verifiedBy: req.user?._id
    });

    res.status(201).json({ message: 'Manual check-in successful', record });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

// Get attendance list for an event
export const getEventAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: eventId } = req.params;
    const records = await AttendanceRecord.find({ eventId })
      .populate('userId', 'firstName lastName email sliitIndex profilePhotoUrl')
      .populate('verifiedBy', 'firstName lastName');
      
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

// Get current user's own attendance records
export const getMyAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const records = await AttendanceRecord.find({ userId })
      .populate({
        path: 'eventId',
        select: 'title startTime endTime type avenue'
      })
      .sort('-createdAt');
      
    // Calculate basic stats
    const pastEvents = await Event.countDocuments({ endTime: { $lt: new Date() } }); // Note: this is club-wide total past events. A real percentage might be based on expected events for that user.
    
    res.json({
      records,
      stats: {
        totalAttended: records.length,
        clubTotalEvents: pastEvents,
        percentage: pastEvents > 0 ? Math.round((records.length / pastEvents) * 100) : 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

// Shared aggregation: per-active-member attendance count/percentage across all past events.
// Used by both the dashboard summary endpoint and the min-attendance alert check.
export const computeAttendanceSummary = async () => {
  const totalEvents = await Event.countDocuments({ endTime: { $lt: new Date() } });

  const attendanceCounts = await AttendanceRecord.aggregate([
    {
      $group: {
        _id: '$userId',
        attendedCount: { $sum: 1 }
      }
    }
  ]);

  const userIds = attendanceCounts.map(ac => ac._id);
  const users = await User.find({ _id: { $in: userIds }, status: 'active' }).select('firstName lastName email sliitIndex avenue');

  // Include active members with zero attendance too, so they show up in low-attendance alerts.
  const allActiveUsers = await User.find({ status: 'active' }).select('firstName lastName email sliitIndex avenue');

  const summary = allActiveUsers.map(user => {
    const record = attendanceCounts.find(ac => ac._id.toString() === user._id.toString());
    const attendedCount = record ? record.attendedCount : 0;
    return {
      user,
      attendedCount,
      percentage: totalEvents > 0 ? Math.round((attendedCount / totalEvents) * 100) : 0
    };
  });

  summary.sort((a, b) => b.percentage - a.percentage);

  return { totalEvents, memberStats: summary };
};

// Get club-wide attendance summary (for dashboard)
export const getAttendanceSummary = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const summary = await computeAttendanceSummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

// Notifies every active member below MIN_ATTENDANCE_THRESHOLD (default 70%).
// Shared by the on-demand endpoint below and the weekly cron job (jobs/minAttendanceCheck.job.ts).
export const runLowAttendanceCheck = async (app: Application) => {
  const threshold = Number(process.env.MIN_ATTENDANCE_THRESHOLD) || 70;
  const { memberStats } = await computeAttendanceSummary();
  const belowThreshold = memberStats.filter((m) => m.percentage < threshold);

  await Promise.all(
    belowThreshold.map((m) =>
      notifyUser(app, {
        userId: m.user._id,
        type: 'low_attendance',
        message: `Your attendance is at ${m.percentage}%, below the club's ${threshold}% minimum. Please attend upcoming events.`,
      })
    )
  );

  return { threshold, totalChecked: memberStats.length, belowThreshold };
};

// On-demand trigger for the min-attendance alert check (also run on a weekly schedule — see jobs/scheduler.ts)
export const checkLowAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { threshold, totalChecked, belowThreshold } = await runLowAttendanceCheck(req.app);

    res.json({
      message: `Checked attendance for ${totalChecked} members; ${belowThreshold.length} below ${threshold}% threshold.`,
      threshold,
      notified: belowThreshold.map((m) => ({ userId: m.user._id, percentage: m.percentage })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};
