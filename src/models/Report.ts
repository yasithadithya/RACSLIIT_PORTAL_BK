import mongoose, { Document, Schema } from 'mongoose';

export interface IReport extends Document {
  title: string;
  type: string;
  period: string;
  generatedData: mongoose.Schema.Types.Mixed;
  generatedBy: mongoose.Types.ObjectId;
}

const ReportSchema: Schema = new Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ['monthly_summary', 'project_report'], required: true },
  period: { type: String, required: true }, // e.g., 'July 2026'
  generatedData: { type: Schema.Types.Mixed, required: true }, // JSON snapshot
  generatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, {
  timestamps: true,
});

export default mongoose.model<IReport>('Report', ReportSchema);
