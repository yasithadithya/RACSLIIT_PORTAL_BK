import mongoose, { Document, Schema } from 'mongoose';

export interface IActionItem {
  _id?: mongoose.Types.ObjectId;
  task: string;
  assigneeId: mongoose.Types.ObjectId;
  dueDate: Date;
  status: 'open' | 'in-progress' | 'done';
}

export interface IMinute extends Document {
  eventId: mongoose.Types.ObjectId;
  agendaItems: string[];
  discussionNotes: string;
  decisions: string[];
  actionItems: IActionItem[];
  attendeesSnapshot: mongoose.Types.ObjectId[];
  status: 'draft' | 'pending_approval' | 'approved';
  draftedBy: mongoose.Types.ObjectId;
  approvedBy?: mongoose.Types.ObjectId;
}

const ActionItemSchema = new Schema({
  task: { type: String, required: true },
  assigneeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ['open', 'in-progress', 'done'], default: 'open' }
});

const MinuteSchema: Schema = new Schema({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, unique: true },
  agendaItems: [{ type: String }],
  discussionNotes: { type: String }, // Markdown supported
  decisions: [{ type: String }],
  actionItems: [ActionItemSchema],
  attendeesSnapshot: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  status: { 
    type: String, 
    enum: ['draft', 'pending_approval', 'approved'], 
    default: 'draft' 
  },
  draftedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true,
});

export default mongoose.model<IMinute>('Minute', MinuteSchema);
