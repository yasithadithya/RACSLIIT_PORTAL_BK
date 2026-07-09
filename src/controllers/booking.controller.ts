import { Request, Response } from 'express';
import Booking from '../models/Booking';
import { AuthRequest } from '../middlewares/auth.middleware';
import { createBookingSchema, updateBookingStatusSchema, paginationSchema, getBookingsQuerySchema } from '../validation/schemas';
import { notifyUser } from '../services/notification.service';
import { z } from 'zod';

export const createBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validatedData = createBookingSchema.parse(req.body);
    
    // Check for conflicts: overlapping approved bookings for the same venue
    const conflict = await Booking.findOne({
      venue: validatedData.venue,
      status: 'approved',
      $or: [
        { startTime: { $lt: validatedData.endTime }, endTime: { $gt: validatedData.startTime } }
      ]
    });

    if (conflict) {
      res.status(409).json({ message: 'Venue is already booked for this time slot.' });
      return;
    }

    const booking = await Booking.create({
      ...validatedData,
      requestedBy: req.user?._id
    });

    res.status(201).json(booking);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation error', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Server error', error: (error as Error).message });
    }
  }
};

export const getBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, sort } = paginationSchema.parse(req.query);
    const { venue, status } = getBookingsQuerySchema.parse(req.query);

    const filter: any = {};
    if (venue) filter.venue = venue;
    if (status) filter.status = status;

    const skip = (page - 1) * limit;

    const bookings = await Booking.find(filter)
      .populate('requestedBy', 'firstName lastName')
      .populate('eventId', 'title avenue')
      .sort(sort || '-createdAt')
      .skip(skip)
      .limit(limit);

    const total = await Booking.countDocuments(filter);

    res.json({
      data: bookings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation error', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Server error', error: (error as Error).message });
    }
  }
};

export const updateBookingStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = updateBookingStatusSchema.parse(req.body);

    const booking = await Booking.findById(id);
    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    // If approving, re-check for conflicts in case another booking was approved in the meantime
    if (status === 'approved') {
      const conflict = await Booking.findOne({
        _id: { $ne: id },
        venue: booking.venue,
        status: 'approved',
        $or: [
          { startTime: { $lt: booking.endTime }, endTime: { $gt: booking.startTime } }
        ]
      });

      if (conflict) {
        res.status(409).json({ message: 'Venue is already booked for this time slot.' });
        return;
      }
    }

    booking.status = status;
    booking.approvedBy = req.user?._id;
    if (rejectionReason) booking.rejectionReason = rejectionReason;

    await booking.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('bookingUpdated', { bookingId: booking._id, status });
    }

    await notifyUser(req.app, {
      userId: booking.requestedBy,
      type: 'booking_status',
      message: `Your booking for ${booking.venue} was ${status}.`,
      relatedEntity: booking._id as any,
    });

    res.json(booking);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation error', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Server error', error: (error as Error).message });
    }
  }
};

export const deleteBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id);

    if (!booking) {
      res.status(404).json({ message: 'Booking not found' });
      return;
    }

    const role: any = req.user?.roleId;
    const hasApprovePermission = role?.permissions?.some(
      (p: any) =>
        (p.resource === 'all' && p.actions.includes('*')) ||
        (p.resource === 'events' && (p.actions.includes('*') || p.actions.includes('approve')))
    );

    if (booking.requestedBy.toString() !== req.user?._id.toString() && !hasApprovePermission) {
      res.status(403).json({ message: 'Not authorized to delete this booking' });
      return;
    }

    await booking.deleteOne();
    res.json({ message: 'Booking removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};
