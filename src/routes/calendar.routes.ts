import express from 'express';
import { getCalendarIcs } from '../controllers/calendar.controller';

const router = express.Router();

// Public route to allow calendar clients (Google Calendar, Outlook) to sync the feed
router.get('/feed.ics', getCalendarIcs);

export default router;
