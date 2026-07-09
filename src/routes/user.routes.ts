import express from 'express';
import {
  getUsers,
  getPendingUsers,
  getUserById,
  approveUser,
  rejectUser,
  updateUser,
  updateUserRole,
  getRoles,
  getMyCalendarToken,
} from '../controllers/user.controller';
import { protect } from '../middlewares/auth.middleware';
import { requirePermission, requireRole } from '../middlewares/rbac.middleware';

const router = express.Router();

// Role listing (for dropdowns in forms) — any authenticated user
router.get('/roles', protect, getRoles);

// Calendar subscription token — any authenticated user (own token only)
router.get('/me/calendar-token', protect, getMyCalendarToken);

// User management — requires 'users' resource permission
router.get('/', protect, requirePermission('users', 'read'), getUsers);
router.get('/pending', protect, requirePermission('users', 'approve'), getPendingUsers);

router.get('/:id', protect, getUserById);
router.patch('/:id', protect, requirePermission('users', 'update'), updateUser);
router.patch('/:id/approve', protect, requirePermission('users', 'approve'), approveUser);
router.patch('/:id/reject', protect, requirePermission('users', 'approve'), rejectUser);
router.patch('/:id/role', protect, requireRole('Admin', 'President'), updateUserRole);

export default router;
