import express from 'express';
import {
  generateQRToken,
  checkIn,
  getEventAttendance,
  manualCheckIn,
  getMyAttendance,
  getAttendanceSummary,
  checkLowAttendance,
  getMyQrToken,
  scanMemberQr,
} from '../controllers/attendance.controller';
import { protect } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';

const router = express.Router();

router.post('/check-in', protect, checkIn);
router.post('/manual-check-in', protect, requirePermission('events', 'update'), manualCheckIn);
router.post('/check-low-attendance', protect, requirePermission('events', 'update'), checkLowAttendance);

// Personal identity QR — any authenticated member can generate/download their own
router.get('/my-qr', protect, getMyQrToken);
// Organizer scans a member's personal QR to mark attendance for an event
router.post('/scan', protect, requirePermission('events', 'update'), scanMemberQr);

router.get('/my-attendance', protect, getMyAttendance);
router.get('/summary', protect, requirePermission('events', 'read'), getAttendanceSummary);

router.get('/event/:id/qr', protect, requirePermission('events', 'update'), generateQRToken);
router.get('/event/:id', protect, requirePermission('events', 'read'), getEventAttendance);

export default router;
