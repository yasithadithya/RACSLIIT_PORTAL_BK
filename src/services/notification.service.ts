import { Application } from 'express';
import mongoose from 'mongoose';
import Notification from '../models/Notification';
import Role from '../models/Role';
import User from '../models/User';

interface NotifyUserInput {
  userId: mongoose.Types.ObjectId | string;
  type: string;
  message: string;
  relatedEntity?: mongoose.Types.ObjectId | string;
}

// Persists a Notification document and pushes it in real time to the user's
// Socket.IO room (joined automatically on connect — see index.ts `socket.join(userId)`).
export const notifyUser = async (app: Application, input: NotifyUserInput): Promise<void> => {
  const notification = await Notification.create({
    userId: input.userId,
    type: input.type,
    message: input.message,
    relatedEntity: input.relatedEntity,
  });

  const io = app.get('io');
  if (io) {
    io.to(input.userId.toString()).emit('newNotification', notification);
  }
};

// Notifies every active user EXCEPT those holding one of the excluded roles.
// Used for board/executive-level alerts (e.g. new member registrations) where
// General/Committee/Prospective members should not be notified.
export const notifyUsersExcludingRoles = async (
  app: Application,
  input: { excludeRoles: string[]; type: string; message: string; relatedEntity?: mongoose.Types.ObjectId | string }
): Promise<void> => {
  const excludedRoles = await Role.find({ name: { $in: input.excludeRoles } }).select('_id');
  const recipients = await User.find({
    status: 'active',
    roleId: { $nin: excludedRoles.map((r) => r._id) },
  }).select('_id');

  await Promise.all(
    recipients.map((user) =>
      notifyUser(app, {
        userId: user._id as mongoose.Types.ObjectId,
        type: input.type,
        message: input.message,
        relatedEntity: input.relatedEntity,
      })
    )
  );
};

// Broadcasts an arbitrary event to everyone in an avenue room (does not persist
// a Notification — use for calendar/list-refresh style signals, not per-user alerts).
export const notifyAvenue = (app: Application, avenue: string, event: string, payload: unknown): void => {
  const io = app.get('io');
  if (io) {
    io.to(`avenue:${avenue}`).emit(event, payload);
  }
};
