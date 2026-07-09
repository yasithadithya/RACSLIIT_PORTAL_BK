import { Request, Response } from 'express';
import ical from 'ical-generator';
import Event from '../models/Event';
import User from '../models/User';
import { expandRecurringEvents } from '../utils/recurrence';

export const getCalendarIcs = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.query.token as string | undefined;
    if (!token) {
      res.status(401).json({ message: 'A calendar subscription token is required' });
      return;
    }

    const user = await User.findOne({ calendarToken: token }).populate('roleId');
    if (!user) {
      res.status(403).json({ message: 'Invalid calendar token' });
      return;
    }

    const role: any = user.roleId;
    const hasClubWideAccess = role?.permissions?.some(
      (p: any) => (p.resource === 'all' || p.resource === 'events') && (p.scope === 'all')
    );

    const filter: any = {};
    if (!hasClubWideAccess && user.avenue) {
      filter.avenue = user.avenue;
    }

    // Look a year back and two years forward for recurring expansion purposes;
    // non-recurring events outside this window are still included via the base query.
    const rangeStart = new Date();
    rangeStart.setFullYear(rangeStart.getFullYear() - 1);
    const rangeEnd = new Date();
    rangeEnd.setFullYear(rangeEnd.getFullYear() + 2);

    const events = await Event.find(filter).sort({ startTime: 1 });
    const expandedEvents = expandRecurringEvents(events, rangeStart, rangeEnd);

    const calendar = ical({
      name: 'Rotaract SLIIT Events',
      prodId: '//Rotaract SLIIT//RAC SLIIT Portal//EN',
      timezone: 'Asia/Colombo',
    });

    expandedEvents.forEach((event) => {
      calendar.createEvent({
        id: event.instanceId,
        start: event.startTime,
        end: event.endTime,
        summary: event.title,
        description: event.description || 'No description provided',
        location: event.location,
        timezone: 'Asia/Colombo',
      });
    });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="racsliit_events.ics"');
    res.send(calendar.toString());
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};
