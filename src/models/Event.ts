import mongoose, { Document, Schema } from 'mongoose';

export interface IEvent extends Document {
  type: 'meeting' | 'project_session' | 'social';
  title: string;
  description?: string;
  linkedProjectId?: mongoose.Types.ObjectId;
  avenue?: string;
  startTime: Date;
  endTime: Date;
  location: string;
  recurringRule?: string; // e.g. RRULE string for recurring events
  createdBy: mongoose.Types.ObjectId;
}

const EventSchema: Schema = new Schema({
  type: { type: String, enum: ['meeting', 'project_session', 'social'], required: true },
  title: { type: String, required: true },
  description: { type: String },
  linkedProjectId: { type: Schema.Types.ObjectId, ref: 'Project' },
  avenue: { type: String },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  location: { type: String, required: true },
  recurringRule: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true,
});

EventSchema.index({ avenue: 1 });
EventSchema.index({ startTime: 1, endTime: 1 });

export default mongoose.model<IEvent>('Event', EventSchema);
