import express from 'express';
import { createEvent, getEvents, getEventById, updateEvent, deleteEvent } from '../controllers/event.controller';
import { protect } from '../middlewares/auth.middleware';
import { requirePermission, checkAvenueScope } from '../middlewares/rbac.middleware';

const router = express.Router();

router.route('/')
  .get(protect, requirePermission('events', 'read'), checkAvenueScope('avenue'), getEvents)
  .post(protect, requirePermission('events', 'create'), checkAvenueScope('avenue'), createEvent);

router.route('/:id')
  .get(protect, requirePermission('events', 'read'), checkAvenueScope('avenue'), getEventById)
  .put(protect, requirePermission('events', 'update'), checkAvenueScope('avenue'), updateEvent)
  .delete(protect, requirePermission('events', 'delete'), checkAvenueScope('avenue'), deleteEvent);

export default router;
