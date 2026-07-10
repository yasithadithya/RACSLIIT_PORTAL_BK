import mongoose, { Document, Schema } from 'mongoose';

export interface IProject extends Document {
  title: string;
  description: string;
  avenue: string;
  leads: mongoose.Types.ObjectId[];
  committeeMembers: mongoose.Types.ObjectId[];
  budget: {
    estimated: number;
    actual: number;
  };
  // Link to the proposed-budget document (Drive/Sheets/PDF, etc.). Mandatory before a
  // proposal can be approved — see approveProject in the project controller.
  budgetProposalUrl?: string;
  status: 'proposed' | 'approved' | 'ongoing' | 'completed' | 'reported' | 'rejected' | 'cancelled';
  statusHistory: {
    status: string;
    changedBy: mongoose.Types.ObjectId;
    changedAt: Date;
    comments?: string;
  }[];
  startDate?: Date;
  endDate?: Date;
  targetBeneficiaries?: string;
  sponsors: {
    name: string;
    contactInfo: string;
  }[];
  externalLinks: {
    label: string;
    url: string;
  }[];
}

const ProjectSchema: Schema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  avenue: { type: String, required: true },
  leads: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  committeeMembers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  budget: {
    estimated: { type: Number, default: 0 },
    actual: { type: Number, default: 0 },
  },
  budgetProposalUrl: { type: String },
  status: {
    type: String,
    enum: ['proposed', 'approved', 'ongoing', 'completed', 'reported', 'rejected', 'cancelled'],
    default: 'proposed'
  },
  statusHistory: [{
    status: { type: String, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now },
    comments: { type: String }
  }],
  startDate: { type: Date },
  endDate: { type: Date },
  targetBeneficiaries: { type: String },
  sponsors: [{
    name: { type: String },
    contactInfo: { type: String }
  }],
  externalLinks: [{
    label: { type: String },
    url: { type: String }
  }]
}, {
  timestamps: true,
});

ProjectSchema.index({ avenue: 1, status: 1 });

export default mongoose.model<IProject>('Project', ProjectSchema);
