import mongoose, { Document, Schema } from 'mongoose';

export interface IBooking extends Document {
  venue: string;
  eventId?: mongoose.Types.ObjectId;
  title: string;
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: mongoose.Types.ObjectId;
  approvedBy?: mongoose.Types.ObjectId;
  reason?: string;
  rejectionReason?: string;
}

const BookingSchema: Schema = new Schema({
  venue: { type: String, required: true },
  eventId: { type: Schema.Types.ObjectId, ref: 'Event' },
  title: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reason: { type: String },
  rejectionReason: { type: String },
}, {
  timestamps: true,
});

BookingSchema.index({ venue: 1, startTime: 1, endTime: 1 });

export default mongoose.model<IBooking>('Booking', BookingSchema);
