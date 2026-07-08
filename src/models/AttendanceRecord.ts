import mongoose, { Document, Schema } from 'mongoose';

export interface IAttendanceRecord extends Document {
  eventId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  checkInTime: Date;
  method: 'qr' | 'manual';
  verifiedBy?: mongoose.Types.ObjectId;
}

const AttendanceRecordSchema: Schema = new Schema({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  checkInTime: { type: Date, default: Date.now },
  method: { type: String, enum: ['qr', 'manual'], required: true },
  verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: true,
});

// Prevent duplicate check-ins
AttendanceRecordSchema.index({ eventId: 1, userId: 1 }, { unique: true });

export default mongoose.model<IAttendanceRecord>('AttendanceRecord', AttendanceRecordSchema);
