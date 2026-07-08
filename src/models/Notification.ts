import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: string;
  message: string;
  relatedEntity?: mongoose.Types.ObjectId;
  read: boolean;
}

const NotificationSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true }, // e.g., 'task_assigned', 'project_approved', 'deadline_approaching'
  message: { type: String, required: true },
  relatedEntity: { type: Schema.Types.ObjectId }, // Flexible ID reference
  read: { type: Boolean, default: false },
}, {
  timestamps: true,
});

export default mongoose.model<INotification>('Notification', NotificationSchema);
