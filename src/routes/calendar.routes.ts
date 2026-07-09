import express from 'express';
import { getCalendarIcs } from '../controllers/calendar.controller';

const router = express.Router();

// Calendar clients (Google Calendar, Outlook) poll this URL unattended, so it can't
// use JWT middleware — authenticated instead via a per-user opaque `token` query param
// (see getMyCalendarToken in user.controller.ts / GET /api/users/me/calendar-token).
router.get('/feed.ics', getCalendarIcs);

export default router;
