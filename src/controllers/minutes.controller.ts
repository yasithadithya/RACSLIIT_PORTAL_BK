import { Request, Response } from 'express';
import Minute from '../models/Minute';
import AttendanceRecord from '../models/AttendanceRecord';
import { AuthRequest } from '../middlewares/auth.middleware';
import { saveDraftSchema, paginationSchema } from '../validation/schemas';
import { z } from 'zod';

export const saveDraft = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validatedData = saveDraftSchema.parse(req.body);
    const { eventId, agendaItems, discussionNotes, decisions, actionItems } = validatedData;
    
    // Auto-pull attendees if saving for the first time
    const attendance = await AttendanceRecord.find({ eventId }).select('userId');
    const attendeesSnapshot = attendance.map(a => a.userId);

    const minute = await Minute.findOneAndUpdate(
      { eventId },
      {
        eventId,
        agendaItems,
        discussionNotes,
        decisions,
        actionItems,
        attendeesSnapshot,
        status: 'draft',
        draftedBy: req.user?._id
      },
      { new: true, upsert: true }
    );

    res.status(201).json(minute);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation error', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Server error', error: (error as Error).message });
    }
  }
};

export const submitForApproval = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const minute = await Minute.findOneAndUpdate(
      { eventId: req.params.eventId },
      { status: 'pending_approval' },
      { new: true }
    );
    if (!minute) {
       res.status(404).json({ message: 'Minutes not found' });
       return;
    }
    res.json(minute);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

export const approveMinutes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const minute = await Minute.findOneAndUpdate(
      { eventId: req.params.eventId },
      { status: 'approved', approvedBy: req.user?._id },
      { new: true }
    );
    if (!minute) {
       res.status(404).json({ message: 'Minutes not found' });
       return;
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('minutesApproved', { eventId: minute.eventId });
      
      // Emit notifications for action items assigned
      minute.actionItems.forEach(item => {
        io.emit('notification', {
          userId: item.assigneeId,
          type: 'action_item_assigned',
          message: `You have been assigned a new action item: ${item.task}`,
          link: '/my-tasks'
        });
      });
    }

    res.json(minute);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

export const getMinutes = async (req: Request, res: Response): Promise<void> => {
  try {
    const minutes = await Minute.findOne({ eventId: req.params.eventId })
      .populate('attendeesSnapshot', 'firstName lastName sliitIndex')
      .populate('actionItems.assigneeId', 'firstName lastName')
      .populate('draftedBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName')
      .populate({
        path: 'eventId',
        select: 'title startTime type avenue',
        populate: {
          path: 'linkedProjectId',
          select: 'title'
        }
      });
    
    if (!minutes) {
       res.status(404).json({ message: 'Minutes not found' });
       return;
    }
    res.json(minutes);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

export const getAllMinutes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, sort } = paginationSchema.parse(req.query);
    const { search, status, avenue } = req.query;

    const filter: any = {};
    if (status) filter.status = status;

    // To filter by avenue, we would need to join with Event or Project, 
    // but a simplified version is just to filter the documents after population or 
    // structure the schema better. For now, we'll fetch and filter if avenue is present.
    
    const skip = (page - 1) * limit;

    let query = Minute.find(filter)
      .populate({
        path: 'eventId',
        select: 'title startTime type avenue',
      })
      .sort(sort || '-updatedAt');

    const minutesList = await query.exec();
    
    // In-memory filter for search & avenue on populated fields
    let filteredList = minutesList;
    if (avenue) {
      filteredList = filteredList.filter(m => (m.eventId as any)?.avenue === avenue);
    }
    if (search) {
      const s = String(search).toLowerCase();
      filteredList = filteredList.filter(m => 
        (m.eventId as any)?.title?.toLowerCase().includes(s) ||
        m.discussionNotes?.toLowerCase().includes(s) ||
        m.decisions?.some(d => d.toLowerCase().includes(s))
      );
    }

    const paginated = filteredList.slice(skip, skip + limit);

    res.json({
      data: paginated,
      pagination: {
        page,
        limit,
        total: filteredList.length,
        totalPages: Math.ceil(filteredList.length / limit)
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation error', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Server error', error: (error as Error).message });
    }
  }
};

export const getMyActionItems = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const minutes = await Minute.find({ 'actionItems.assigneeId': req.user?._id })
      .populate('eventId', 'title avenue type');

    let myActionItems: any[] = [];
    minutes.forEach(minute => {
      minute.actionItems.forEach(item => {
        if (item.assigneeId.toString() === req.user?._id.toString()) {
          myActionItems.push({
             ...(item as any).toObject(),
             eventId: minute.eventId,
             minuteId: minute._id,
             minuteStatus: minute.status // to know if it's an approved action item
          });
        }
      });
    });

    res.json(myActionItems);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

export const updateActionItemStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { minuteId, actionItemId } = req.params;
        const { status } = req.body;

        const minute = await Minute.findOneAndUpdate(
            { _id: minuteId, 'actionItems._id': actionItemId, 'actionItems.assigneeId': req.user?._id },
            { $set: { 'actionItems.$.status': status } },
            { new: true }
        );

        if (!minute) {
            res.status(404).json({ message: 'Action item not found or unauthorized' });
            return;
        }

        res.json({ message: 'Status updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: (error as Error).message });
    }
}
