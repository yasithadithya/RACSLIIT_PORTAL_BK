import express from 'express';
import { 
  generateQRToken, 
  checkIn, 
  getEventAttendance, 
  manualCheckIn, 
  getMyAttendance, 
  getAttendanceSummary 
} from '../controllers/attendance.controller';
import { protect } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';

const router = express.Router();

router.post('/check-in', protect, checkIn);
router.post('/manual-check-in', protect, requirePermission('events', 'update'), manualCheckIn);

router.get('/my-attendance', protect, getMyAttendance);
router.get('/summary', protect, requirePermission('events', 'read'), getAttendanceSummary);

router.get('/event/:id/qr', protect, requirePermission('events', 'update'), generateQRToken);
router.get('/event/:id', protect, requirePermission('events', 'read'), getEventAttendance);

export default router;
