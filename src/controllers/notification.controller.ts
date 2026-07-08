import { Request, Response } from 'express';
import Notification from '../models/Notification';
import { AuthRequest } from '../middlewares/auth.middleware';

export const getMyNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notifications = await Notification.find({ userId: req.user?._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const query = id === 'all' 
      ? { userId: req.user?._id, read: false }
      : { _id: id, userId: req.user?._id };

    await Notification.updateMany(query, { $set: { read: true } });
    res.json({ message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};
