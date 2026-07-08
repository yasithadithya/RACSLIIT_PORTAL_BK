import express from 'express';
import { saveDraft, submitForApproval, approveMinutes, getMinutes, getMyActionItems, updateActionItemStatus, getAllMinutes } from '../controllers/minutes.controller';
import { protect } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';

const router = express.Router();

router.get('/', protect, requirePermission('minutes', 'read'), getAllMinutes);
router.get('/my-action-items', protect, getMyActionItems);
router.patch('/:minuteId/action-items/:actionItemId', protect, updateActionItemStatus);

router.route('/event/:eventId')
  .get(protect, getMinutes)
  .post(protect, requirePermission('minutes', 'create'), saveDraft);

router.post('/event/:eventId/submit', protect, requirePermission('minutes', 'update'), submitForApproval);
router.post('/event/:eventId/approve', protect, requirePermission('minutes', 'approve'), approveMinutes);

export default router;
