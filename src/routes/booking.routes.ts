import express from 'express';
import { createBooking, getBookings, updateBookingStatus, deleteBooking } from '../controllers/booking.controller';
import { protect } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';

const router = express.Router();

router.route('/')
  .get(protect, getBookings)
  .post(protect, requirePermission('events', 'create'), createBooking);

router.route('/:id')
  .delete(protect, deleteBooking);

router.patch('/:id/status', protect, requirePermission('events', 'approve'), updateBookingStatus);

export default router;
