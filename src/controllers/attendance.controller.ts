import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import AttendanceRecord from '../models/AttendanceRecord';
import Event from '../models/Event';
import User from '../models/User';
import { AuthRequest } from '../middlewares/auth.middleware';

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
      process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_prod',
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
        process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_prod'
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

      const record = await AttendanceRecord.create({
        eventId: decoded.eventId,
        userId: userId,
        method: 'qr',
      });

      res.status(201).json({ message: 'Check-in successful', record });
    } catch (tokenError) {
      res.status(400).json({ message: 'Invalid or expired QR code' });
    }
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

// Get club-wide attendance summary (for dashboard)
export const getAttendanceSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // 1. Get total past events
    const totalEvents = await Event.countDocuments({ endTime: { $lt: new Date() } });
    
    // 2. Aggregate attendance counts per user
    const attendanceCounts = await AttendanceRecord.aggregate([
      {
        $group: {
          _id: '$userId',
          attendedCount: { $sum: 1 }
        }
      }
    ]);
    
    // 3. Populate user info manually (aggregation doesn't auto-populate easily with Mongoose references)
    const userIds = attendanceCounts.map(ac => ac._id);
    const users = await User.find({ _id: { $in: userIds }, status: 'active' }).select('firstName lastName email sliitIndex avenue');
    
    const summary = users.map(user => {
      const record = attendanceCounts.find(ac => ac._id.toString() === user._id.toString());
      const attendedCount = record ? record.attendedCount : 0;
      return {
        user,
        attendedCount,
        percentage: totalEvents > 0 ? Math.round((attendedCount / totalEvents) * 100) : 0
      };
    });
    
    // Sort by percentage descending
    summary.sort((a, b) => b.percentage - a.percentage);

    res.json({
      totalEvents,
      memberStats: summary
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};
