import express from 'express';
import { getMyNotifications, markAsRead } from '../controllers/notification.controller';
import { protect } from '../middlewares/auth.middleware';

const router = express.Router();

router.get('/', protect, getMyNotifications);
router.patch('/:id/read', protect, markAsRead);

export default router;
