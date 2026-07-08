import { Request, Response } from 'express';
import Event from '../models/Event';
import { AuthRequest } from '../middlewares/auth.middleware';
import { createEventSchema, updateEventSchema, paginationSchema } from '../validation/schemas';
import { z } from 'zod';

export const createEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validatedData = createEventSchema.parse(req.body);
    const scope = (req as any).permissionScope;
    const scopedAvenue = (req as any).scopedAvenue;

    if (scope === 'avenue' && scopedAvenue && validatedData.avenue !== scopedAvenue) {
      res.status(403).json({ message: `Forbidden: You can only create events for the ${scopedAvenue} avenue.` });
      return;
    }

    const event = await Event.create({
      ...validatedData,
      createdBy: req.user?._id
    });
    
    // Emit real-time calendar update
    const io = req.app.get('io');
    if (io) {
      io.emit('calendarUpdated', { action: 'created', event });
    }

    res.status(201).json(event);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation error', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Server error', error: (error as Error).message });
    }
  }
};

export const getEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const { start, end, avenue, type } = req.query;
    const scopedAvenue = (req as any).scopedAvenue;

    const filter: any = {};
    
    // Support FullCalendar date range fetch
    if (start && end) {
      filter.startTime = { $gte: new Date(start as string) };
      filter.endTime = { $lte: new Date(end as string) };
    }

    if (type) filter.type = type;

    if (scopedAvenue) {
      filter.avenue = scopedAvenue;
    } else if (avenue) {
      filter.avenue = avenue;
    }

    const events = await Event.find(filter)
      .populate('linkedProjectId', 'title avenue')
      .populate('createdBy', 'firstName lastName');

    res.json(events);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

export const getEventById = async (req: Request, res: Response): Promise<void> => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('linkedProjectId', 'title avenue')
      .populate('createdBy', 'firstName lastName');

    if (!event) {
      res.status(404).json({ message: 'Event not found' });
      return;
    }

    const scopedAvenue = (req as any).scopedAvenue;
    if (scopedAvenue && event.avenue !== scopedAvenue) {
      res.status(403).json({ message: 'Forbidden: Event is outside your avenue' });
      return;
    }

    res.json(event);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

export const updateEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validatedData = updateEventSchema.parse(req.body);
    const event = await Event.findById(req.params.id);

    if (!event) {
      res.status(404).json({ message: 'Event not found' });
      return;
    }

    const scopedAvenue = (req as any).scopedAvenue;
    if (scopedAvenue && event.avenue !== scopedAvenue) {
      res.status(403).json({ message: 'Forbidden: Event is outside your avenue' });
      return;
    }

    if (validatedData.avenue && scopedAvenue && validatedData.avenue !== scopedAvenue) {
      res.status(403).json({ message: 'Forbidden: Cannot move event outside your avenue' });
      return;
    }

    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      { $set: validatedData },
      { new: true }
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('calendarUpdated', { action: 'updated', event: updatedEvent });
    }

    res.json(updatedEvent);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation error', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Server error', error: (error as Error).message });
    }
  }
};

export const deleteEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      res.status(404).json({ message: 'Event not found' });
      return;
    }

    const scopedAvenue = (req as any).scopedAvenue;
    if (scopedAvenue && event.avenue !== scopedAvenue) {
      res.status(403).json({ message: 'Forbidden: Event is outside your avenue' });
      return;
    }

    await Event.findByIdAndDelete(req.params.id);

    const io = req.app.get('io');
    if (io) {
      io.emit('calendarUpdated', { action: 'deleted', eventId: req.params.id });
    }

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};
