import { Request, Response } from 'express';
import Event from '../models/Event';

export const getCalendarIcs = async (req: Request, res: Response): Promise<void> => {
  try {
    const events = await Event.find().sort({ startTime: 1 });

    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Rotaract SLIIT//NONSGML RAC SLIIT Portal//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Rotaract SLIIT Events',
      'X-WR-TIMEZONE:Asia/Colombo'
    ];

    events.forEach((event) => {
      const dtstart = event.startTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const dtend = event.endTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const uid = `${event._id}@racsliit.org`;

      icsContent.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${dtstart}`,
        `DTEND:${dtend}`,
        `SUMMARY:${event.title}`,
        `DESCRIPTION:${event.description || 'No description provided'}`,
        `LOCATION:${event.location}`,
        'END:VEVENT'
      );
    });

    icsContent.push('END:VCALENDAR');

    const icsString = icsContent.join('\r\n');

    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', 'attachment; filename="racsliit_events.ics"');
    res.send(icsString);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};
